import { spawn } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

type ProcessSnapshot = {
  pid: number;
  name: string;
  parentProcessId: number | null;
  commandLine: string;
  cpu: number | null;
  startTime: string | null;
};

type QueueFile = {
  name: string;
  updated_at: string;
};

type BuilderResultDetails = {
  task_id: string | null;
  status: string | null;
  exit_code: number | null;
  finished_at: string | null;
  summary: string | null;
  image_ref: string | null;
};

type ReviewerResultDetails = {
  reviewed_task_id: string | null;
  verdict: string | null;
  reviewed_at: string | null;
  summary: string | null;
  next_task_id: string | null;
  image_ref: string | null;
};

export type LocalRuntimeStatus = {
  checked_at: string;
  status: "working" | "idle" | "unknown";
  queue: {
    path: string | null;
    inbox: number;
    processing: number;
    outbox: number;
    reviews: number;
  };
  active_task: string | null;
  processes: {
    implementer: ProcessSnapshot | null;
    reviewer: ProcessSnapshot | null;
    loop: ProcessSnapshot | null;
    reviewer_bridge: ProcessSnapshot | null;
  };
  latest: {
    processing: QueueFile | null;
    outbox: QueueFile | null;
    review: QueueFile | null;
  };
  latest_details: {
    builder: BuilderResultDetails | null;
    reviewer: ReviewerResultDetails | null;
  };
  judgement: string;
};

let runtimeCache: { value: LocalRuntimeStatus; expiresAt: number } | null = null;
let runtimeInFlight: Promise<LocalRuntimeStatus> | null = null;

export async function getLocalRuntimeStatus(): Promise<LocalRuntimeStatus> {
  const now = Date.now();
  if (runtimeCache && runtimeCache.expiresAt > now) {
    return runtimeCache.value;
  }

  if (runtimeInFlight) {
    return runtimeInFlight;
  }

  runtimeInFlight = readLocalRuntimeStatusFresh()
    .then((status) => {
      runtimeCache = {
        value: status,
        expiresAt: Date.now() + 3000,
      };
      return status;
    })
    .finally(() => {
      runtimeInFlight = null;
    });

  return runtimeInFlight;
}

async function readLocalRuntimeStatusFresh(): Promise<LocalRuntimeStatus> {
  const checkedAt = new Date().toISOString();
  const processes = await readCodexProcesses().catch(() => []);
  const loop = findLoopProcess(processes);
  const implementer =
    findImplementerProcess(processes, loop?.pid ?? null) ??
    (await readConfiguredProcess(process.env.CODEX_IMPLEMENTER_PID, "codex.exe", "configured implementer pid"));
  const reviewer =
    findReviewerProcess(processes) ??
    (await readConfiguredProcess(process.env.CODEX_REVIEWER_PID, "codex.exe", "configured reviewer pid"));
  const reviewerBridge = findReviewerBridgeProcess(processes);
  const configuredQueuePath = process.env.MCP_QUEUE_PATH?.trim() || null;
  const configuredRepoPath = process.env.MCP_REPO_PATH?.trim() || null;
  const repoPath = configuredRepoPath ?? (loop ? extractRepoPath(loop.commandLine) : null);
  const queuePath = configuredQueuePath ?? (repoPath ? path.join(repoPath, "tools", "mcp-codex-bridge", "queue") : null);
  const queue = await readQueueSnapshot(queuePath);
  const latestDetails = await readLatestDetails(queuePath, queue.latest.outbox, queue.latest.review);
  const activeTask = queue.latest.processing ? stripTaskExtension(queue.latest.processing.name) : null;
  const status = queue.counts.processing > 0 && implementer ? "working" : queue.counts.processing > 0 ? "unknown" : "idle";

  return {
    checked_at: checkedAt,
    status,
    queue: {
      path: queuePath,
      inbox: queue.counts.inbox,
      processing: queue.counts.processing,
      outbox: queue.counts.outbox,
      reviews: queue.counts.reviews,
    },
    active_task: activeTask,
    processes: {
      implementer,
      reviewer,
      loop,
      reviewer_bridge: reviewerBridge,
    },
    latest: queue.latest,
    latest_details: latestDetails,
    judgement: buildJudgement(
      status,
      queue.counts.processing,
      implementer,
      reviewer,
      reviewerBridge,
      queue.latest.review,
      queue.latest.outbox,
    ),
  };
}

async function readCodexProcesses(): Promise<ProcessSnapshot[]> {
  if (process.platform !== "win32") {
    return [];
  }

  const targeted = await readTargetedRuntimeProcesses();
  if (targeted.length) {
    return targeted;
  }

  return readBroadCodexProcesses();
}

async function readTargetedRuntimeProcesses(): Promise<ProcessSnapshot[]> {
  const rootPids = (
    await Promise.all([
      readPidValue(process.env.CODEX_IMPLEMENTER_PID),
      readPidValue(process.env.CODEX_REVIEWER_PID),
      readPidFile(path.resolve(process.cwd(), "..", "tools", "runtime", "pids", "mcp-queue-loop.pid")),
    ])
  ).filter((pid): pid is number => Number.isInteger(pid));

  if (!rootPids.length) {
    return [];
  }

  const pidList = rootPids.join(", ");
  const script = [
    `$queue = [System.Collections.Generic.Queue[int]]::new()`,
    `$seen = @{}`,
    `$items = @()`,
    `foreach ($pid in @(${pidList})) { $queue.Enqueue([int]$pid) }`,
    "while ($queue.Count -gt 0) {",
    "  $pid = $queue.Dequeue()",
    "  if ($seen.ContainsKey([string]$pid)) { continue }",
    "  $seen[[string]$pid] = $true",
    "  $proc = Get-CimInstance Win32_Process -Filter \"ProcessId=$pid\" -ErrorAction SilentlyContinue",
    "  if ($proc) {",
    "    $p = Get-Process -Id $proc.ProcessId -ErrorAction SilentlyContinue",
    "    $items += [PSCustomObject]@{",
    "      pid = $proc.ProcessId",
    "      name = $proc.Name",
    "      parentProcessId = $proc.ParentProcessId",
    "      commandLine = $proc.CommandLine",
    "      cpu = if ($p) { $p.CPU } else { $null }",
    "      startTime = if ($p) { $p.StartTime.ToUniversalTime().ToString('o') } else { $null }",
    "    }",
    "  }",
    "  $children = Get-CimInstance Win32_Process -Filter \"ParentProcessId=$pid\" -ErrorAction SilentlyContinue",
    "  foreach ($child in $children) { $queue.Enqueue([int]$child.ProcessId) }",
    "}",
    "$items | ConvertTo-Json -Depth 4 -Compress",
  ].join("\n");

  try {
    const output = await runPowerShell(script, 7000);
    if (!output.trim()) {
      return [];
    }

    const parsed = JSON.parse(output) as ProcessSnapshot | ProcessSnapshot[];
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

async function readPidValue(rawPid: string | undefined) {
  if (!rawPid) {
    return null;
  }

  const pid = Number(rawPid);
  return Number.isInteger(pid) ? pid : null;
}

async function readPidFile(filePath: string) {
  try {
    const pid = Number((await readFile(filePath, "utf-8")).trim());
    return Number.isInteger(pid) ? pid : null;
  } catch {
    return null;
  }
}

async function readBroadCodexProcesses(): Promise<ProcessSnapshot[]> {
  const script = [
    "$items = Get-CimInstance Win32_Process -Filter \"Name = 'codex.exe' OR Name = 'node.exe' OR Name = 'powershell.exe' OR Name = 'pwsh.exe' OR Name = 'bash.exe'\" | Where-Object {",
    "  $_.CommandLine -match 'Run-ModularLoop|run-modular-loop|gpt-session-bridge|@openai\\\\codex|codex.exe'",
    "} | ForEach-Object {",
    "  $p = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue",
    "  [PSCustomObject]@{",
    "    pid = $_.ProcessId",
    "    name = $_.Name",
    "    parentProcessId = $_.ParentProcessId",
    "    commandLine = $_.CommandLine",
    "    cpu = if ($p) { $p.CPU } else { $null }",
    "    startTime = if ($p) { $p.StartTime.ToUniversalTime().ToString('o') } else { $null }",
    "  }",
    "}",
    "$items | ConvertTo-Json -Depth 4 -Compress",
  ].join("\n");

  const output = await runPowerShell(script);

  if (!output.trim()) {
    return [];
  }

  const parsed = JSON.parse(output) as ProcessSnapshot | ProcessSnapshot[];
  return Array.isArray(parsed) ? parsed : [parsed];
}

function runPowerShell(script: string, timeoutMs = 20000): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
      shell: false,
      windowsHide: true,
    });

    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      child.kill("SIGTERM");
      reject(new Error("Timed out while reading local runtime status."));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (exitCode) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);

      if (exitCode === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr || "Failed to read local runtime status."));
    });
  });
}

async function readConfiguredProcess(rawPid: string | undefined, name: string, commandLine: string) {
  if (!rawPid) {
    return null;
  }

  const pid = Number(rawPid);

  if (!Number.isInteger(pid)) {
    return null;
  }

  const script = [
    `$p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue`,
    "if ($p) {",
    "  [PSCustomObject]@{",
    `    pid = ${pid}`,
    `    name = "${name}"`,
    "    parentProcessId = $null",
    `    commandLine = "${commandLine}"`,
    "    cpu = $p.CPU",
    "    startTime = $p.StartTime.ToUniversalTime().ToString('o')",
    "  } | ConvertTo-Json -Depth 4 -Compress",
    "}",
  ].join("\n");

  try {
    const output = await runPowerShell(script);

    if (!output.trim()) {
      return null;
    }

    return JSON.parse(output) as ProcessSnapshot;
  } catch {
    return null;
  }
}

async function readQueueSnapshot(queuePath: string | null) {
  const empty = {
    counts: { inbox: 0, processing: 0, outbox: 0, reviews: 0 },
    latest: { processing: null, outbox: null, review: null } as {
      processing: QueueFile | null;
      outbox: QueueFile | null;
      review: QueueFile | null;
    },
  };

  if (!queuePath) {
    return empty;
  }

  const [inbox, processing, outbox, reviews] = await Promise.all([
    listQueueFiles(path.join(queuePath, "inbox"), ".json"),
    listQueueFiles(path.join(queuePath, "processing"), ".json"),
    listQueueFiles(path.join(queuePath, "outbox"), ".result.json"),
    listQueueFiles(path.join(queuePath, "reviews"), ".review.json"),
  ]);

  const reviewerOutbox = await findLatestReviewerOutboxFile(path.join(queuePath, "outbox"), outbox);
  const latestReview = pickLatestQueueFile(reviews[0] ?? null, reviewerOutbox);

  return {
    counts: {
      inbox: inbox.length,
      processing: processing.length,
      outbox: outbox.length,
      reviews: reviews.length,
    },
    latest: {
      processing: processing[0] ?? null,
      outbox: outbox[0] ?? null,
      review: latestReview,
    },
  };
}

async function readLatestDetails(
  queuePath: string | null,
  outbox: QueueFile | null,
  review: QueueFile | null,
) {
  if (!queuePath) {
    return { builder: null, reviewer: null };
  }

  const outboxDir = path.join(queuePath, "outbox");
  const reviewsDir = path.join(queuePath, "reviews");
  const builderOutbox = await findLatestBuilderOutboxFile(outboxDir);
  const reviewPath = review
    ? path.join(review.name.endsWith(".result.json") ? outboxDir : reviewsDir, review.name)
    : null;

  const [builder, reviewer] = await Promise.all([
    builderOutbox ? readBuilderResult(path.join(outboxDir, builderOutbox.name)) : outbox ? readBuilderResult(path.join(outboxDir, outbox.name)) : null,
    reviewPath ? readReviewerResult(reviewPath) : null,
  ]);

  return { builder, reviewer };
}

async function readBuilderResult(filePath: string): Promise<BuilderResultDetails | null> {
  try {
    const payload = JSON.parse(await readFile(filePath, "utf-8")) as {
      task_id?: string;
      status?: string;
      finished_at?: string;
      screenshot?: string;
      screenshot_path?: string;
      screenshot_url?: string;
      image?: string;
      image_path?: string;
      image_url?: string;
      artifact?: {
        screenshot?: string;
        image?: string;
        path?: string;
        url?: string;
      };
      codex?: {
        exit_code?: number;
        stdout?: string;
        stderr?: string;
      };
    };

    return {
      task_id: payload.task_id ?? null,
      status: payload.status ?? null,
      exit_code: typeof payload.codex?.exit_code === "number" ? payload.codex.exit_code : null,
      finished_at: payload.finished_at ?? null,
      summary: summarizeText(payload.codex?.stdout || payload.codex?.stderr || null),
      image_ref: extractImageRef(payload),
    };
  } catch {
    return null;
  }
}

async function readReviewerResult(filePath: string): Promise<ReviewerResultDetails | null> {
  try {
    const payload = JSON.parse(await readFile(filePath, "utf-8")) as {
      task_id?: string;
      parent_task_id?: string;
      role?: string;
      finished_at?: string;
      reviewed_task_id?: string;
      reviewed_at?: string;
      verdict?: string;
      review_summary?: string;
      screenshot?: string;
      screenshot_path?: string;
      screenshot_url?: string;
      image?: string;
      image_path?: string;
      image_url?: string;
      artifact?: {
        screenshot?: string;
        image?: string;
        path?: string;
        url?: string;
      };
      next_task?: {
        task_id?: string;
      } | null;
      codex?: {
        stdout?: string;
        stderr?: string;
      };
    };

    const stdout = payload.codex?.stdout?.trim() ?? "";
    const parsedVerdict = parseReviewerVerdict(stdout);
    const summarySource = payload.review_summary ?? (stdout ? stdout : (payload.codex?.stderr ?? null));

    return {
      reviewed_task_id: payload.reviewed_task_id ?? payload.parent_task_id ?? payload.task_id ?? null,
      verdict: payload.verdict ?? parsedVerdict,
      reviewed_at: payload.reviewed_at ?? payload.finished_at ?? null,
      summary: summarizeText(summarySource),
      next_task_id: payload.next_task?.task_id ?? null,
      image_ref: extractImageRef(payload),
    };
  } catch {
    return null;
  }
}

async function listQueueFiles(directory: string, suffix: string): Promise<QueueFile[]> {
  try {
    const names = (await readdir(directory)).filter((name) => name.endsWith(suffix));
    const files = await Promise.all(
      names.map(async (name) => {
        const fileStat = await stat(path.join(directory, name));
        return {
          name,
          updated_at: fileStat.mtime.toISOString(),
        };
      }),
    );

    return files.sort((left, right) => right.updated_at.localeCompare(left.updated_at));
  } catch {
    return [];
  }
}

async function findLatestReviewerOutboxFile(outboxDirectory: string, outboxFiles: QueueFile[]) {
  for (const file of outboxFiles) {
    if (await isReviewerOutboxResult(path.join(outboxDirectory, file.name))) {
      return file;
    }
  }

  return null;
}

async function findLatestBuilderOutboxFile(outboxDirectory: string) {
  const outboxFiles = await listQueueFiles(outboxDirectory, ".result.json");

  for (const file of outboxFiles) {
    if (!(await isReviewerOutboxResult(path.join(outboxDirectory, file.name)))) {
      return file;
    }
  }

  return null;
}

async function isReviewerOutboxResult(filePath: string) {
  try {
    const payload = JSON.parse(await readFile(filePath, "utf-8")) as {
      role?: string;
      instruction?: string;
      task_id?: string;
      codex?: {
        stdout?: string;
      };
    };
    const stdout = payload.codex?.stdout?.trim() ?? "";

    return (
      payload.role === "reviewer" ||
      /^Review only\./i.test(payload.instruction ?? "") ||
      /final-review/i.test(payload.task_id ?? "") ||
      parseReviewerVerdict(stdout) !== null
    );
  } catch {
    return false;
  }
}

function pickLatestQueueFile(left: QueueFile | null, right: QueueFile | null) {
  if (!left) return right;
  if (!right) return left;
  return right.updated_at > left.updated_at ? right : left;
}

function parseReviewerVerdict(value: string) {
  const firstLine = value
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .find(Boolean);

  if (firstLine === "approve" || firstLine === "reject" || firstLine === "hold") {
    return firstLine;
  }

  return null;
}

function findLoopProcess(processes: ProcessSnapshot[]) {
  return (
    processes.find((processItem) => /-File\s+.+Run-ModularLoop\.ps1/i.test(processItem.commandLine)) ??
    processes.find((processItem) => /bash\.exe.+run-modular-loop/i.test(processItem.commandLine)) ??
    null
  );
}

function findImplementerProcess(processes: ProcessSnapshot[], loopPid: number | null) {
  const configured = findConfiguredProcess(processes, process.env.CODEX_IMPLEMENTER_PID);

  if (configured) {
    return configured;
  }

  const candidates = processes.filter(
    (processItem) =>
      processItem.name === "codex.exe" &&
      /exec\s+-/i.test(processItem.commandLine) &&
      processItem.pid !== loopPid,
  );

  if (loopPid) {
    const loopChild = candidates.find((processItem) => processItem.parentProcessId === loopPid);

    if (loopChild) {
      return loopChild;
    }
  }

  return candidates.sort((left, right) => (right.cpu ?? 0) - (left.cpu ?? 0))[0] ?? null;
}

function findReviewerProcess(processes: ProcessSnapshot[]) {
  return findConfiguredProcess(processes, process.env.CODEX_REVIEWER_PID);
}

function findReviewerBridgeProcess(processes: ProcessSnapshot[]) {
  return processes.find((processItem) => /gpt-session-bridge\.mjs/i.test(processItem.commandLine)) ?? null;
}

function findConfiguredProcess(processes: ProcessSnapshot[], rawPid: string | undefined) {
  if (!rawPid) {
    return null;
  }

  const pid = Number(rawPid);

  if (!Number.isInteger(pid)) {
    return null;
  }

  return processes.find((processItem) => processItem.pid === pid) ?? null;
}

function extractRepoPath(commandLine: string) {
  const quotedMatch = commandLine.match(/-RepoPath\s+["']([^"']+)["']\s+-Branch/i);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  const match = commandLine.match(/-RepoPath\s+(.+?)\s+-Branch/i);
  return match?.[1]?.trim() ?? null;
}

function stripTaskExtension(fileName: string) {
  return fileName.replace(/\.result\.json$|\.review\.json$|\.json$/i, "");
}

function summarizeText(value: string | null) {
  if (!value) {
    return null;
  }

  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > 420 ? `${clean.slice(0, 420)}...` : clean;
}

function extractImageRef(payload: {
  screenshot?: string;
  screenshot_path?: string;
  screenshot_url?: string;
  image?: string;
  image_path?: string;
  image_url?: string;
  artifact?: {
    screenshot?: string;
    image?: string;
    path?: string;
    url?: string;
  };
}) {
  return (
    payload.screenshot_url ??
    payload.image_url ??
    payload.screenshot_path ??
    payload.image_path ??
    payload.screenshot ??
    payload.image ??
    payload.artifact?.url ??
    payload.artifact?.path ??
    payload.artifact?.screenshot ??
    payload.artifact?.image ??
    null
  );
}

function buildJudgement(
  status: LocalRuntimeStatus["status"],
  processingCount: number,
  implementer: ProcessSnapshot | null,
  reviewer: ProcessSnapshot | null,
  reviewerBridge: ProcessSnapshot | null,
  latestReview: QueueFile | null,
  latestOutbox: QueueFile | null,
) {
  if (status === "working" && (reviewer || reviewerBridge)) {
    const reviewNote =
      latestReview && latestOutbox && latestReview.updated_at > latestOutbox.updated_at
        ? " Latest review is newer than the latest outbox result."
        : " No newer review than the latest outbox result was detected.";
    return `Implementer is running with ${processingCount} task in processing.${reviewNote}`;
  }

  if (processingCount > 0 && !implementer) {
    return "A task is in processing, but no active Codex implementer process was detected.";
  }

  if (implementer && reviewer) {
    return "Manual implementer and reviewer Codex sessions are detected. No active processing task was detected.";
  }

  if (implementer && !reviewer && !reviewerBridge) {
    return "Codex implementer is detected, but no reviewer Codex or reviewer bridge is detected.";
  }

  return "No active processing task was detected.";
}

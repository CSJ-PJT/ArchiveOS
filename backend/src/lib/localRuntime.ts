import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
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
  judgement: string;
};

export async function getLocalRuntimeStatus(): Promise<LocalRuntimeStatus> {
  const checkedAt = new Date().toISOString();
  const processes = await readCodexProcesses();
  const loop = findLoopProcess(processes);
  const implementer = findImplementerProcess(processes, loop?.pid ?? null);
  const reviewer = findReviewerProcess(processes);
  const reviewerBridge = findReviewerBridgeProcess(processes);
  const repoPath = loop ? extractRepoPath(loop.commandLine) : null;
  const queuePath = repoPath ? path.join(repoPath, "tools", "mcp-codex-bridge", "queue") : null;
  const queue = await readQueueSnapshot(queuePath);
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

  const script = [
    "$items = Get-CimInstance Win32_Process | Where-Object {",
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

function runPowerShell(script: string): Promise<string> {
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
    }, 10000);

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
      review: reviews[0] ?? null,
    },
  };
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
  const match = commandLine.match(/-RepoPath\s+(.+?)\s+-Branch/i);
  return match?.[1] ?? null;
}

function stripTaskExtension(fileName: string) {
  return fileName.replace(/\.result\.json$|\.review\.json$|\.json$/i, "");
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

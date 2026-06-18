import { supabaseAdmin } from "../lib/supabaseAdmin.js";
import { recordBatchRun } from "./store.js";
import type { BatchResult } from "./types.js";

type KeepAliveTarget = {
  id: string;
  label: string;
  url: string | undefined;
  key: string | undefined;
  mode: "supabase-js" | "rest";
};

type KeepAliveTargetResult = {
  id: string;
  label: string;
  configured: boolean;
  status: "ok" | "skipped" | "failed";
  statusCode?: number;
  reason?: string;
};

export async function runSupabaseKeepAliveBatch(): Promise<BatchResult> {
  const targetDate = toKoreanDate(new Date());
  const targets: KeepAliveTarget[] = [
    {
      id: "archiveos",
      label: "ArchiveOS",
      url: process.env.SUPABASE_URL,
      key: process.env.SUPABASE_SERVICE_ROLE_KEY,
      mode: "supabase-js",
    },
    {
      id: "rh-healthcare",
      label: "RH Healthcare",
      url: process.env.RH_HEALTHCARE_SUPABASE_URL,
      key: process.env.RH_HEALTHCARE_SUPABASE_PUBLISHABLE_KEY,
      mode: "rest",
    },
    {
      id: "rh-healthcare-paused-ref",
      label: "RH Healthcare paused project ref",
      url: process.env.RH_HEALTHCARE_PAUSED_SUPABASE_URL,
      key: process.env.RH_HEALTHCARE_PAUSED_SUPABASE_PUBLISHABLE_KEY,
      mode: "rest",
    },
  ];

  const results = await Promise.all(targets.map(runTargetKeepAlive));
  const configuredResults = results.filter((result) => result.configured);
  const failedResults = configuredResults.filter((result) => result.status === "failed");
  const skippedResults = results.filter((result) => result.status === "skipped");

  const status =
    configuredResults.length === 0
      ? "skipped"
      : failedResults.length > 0
        ? "failed"
        : "completed";

  const summary = [
    "Supabase keep-alive batch completed.",
    `Configured targets: ${configuredResults.length}`,
    `OK: ${configuredResults.filter((result) => result.status === "ok").length}`,
    `Failed: ${failedResults.length}`,
    skippedResults.length ? `Skipped: ${skippedResults.map((result) => result.label).join(", ")}` : null,
  ].filter(Boolean).join(" ");

  return recordBatchRun({
    batch_type: "supabase_keepalive",
    status,
    target_date: targetDate,
    summary,
    metadata: {
      target_date: targetDate,
      targets: results,
      note: "Daily lightweight Supabase reads to reduce free-tier inactivity pause risk. Secrets are backend-only.",
    },
  });
}

async function runTargetKeepAlive(target: KeepAliveTarget): Promise<KeepAliveTargetResult> {
  if (!target.url || (target.mode === "supabase-js" && !target.key)) {
    return {
      id: target.id,
      label: target.label,
      configured: false,
      status: "skipped",
      reason: `${target.label} Supabase URL/key is not configured.`,
    };
  }

  try {
    if (target.mode === "supabase-js") {
      const { error } = await supabaseAdmin
        .from("batch_runs")
        .select("id", { count: "exact", head: true })
        .limit(1);

      if (error) {
        return {
          id: target.id,
          label: target.label,
          configured: true,
          status: "failed",
          reason: error.message,
        };
      }

      return {
        id: target.id,
        label: target.label,
        configured: true,
        status: "ok",
      };
    }

    const endpoint = new URL("/rest/v1/", target.url);
    const headers: Record<string, string> = {};
    if (target.key) {
      headers.apikey = target.key;
      headers.Authorization = `Bearer ${target.key}`;
    }

    const response = await fetch(endpoint, {
      method: "GET",
      headers,
    });

    return {
      id: target.id,
      label: target.label,
      configured: true,
      status: response.ok || response.status === 401 || response.status === 404 ? "ok" : "failed",
      statusCode: response.status,
      reason: response.ok ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      id: target.id,
      label: target.label,
      configured: true,
      status: "failed",
      reason: describeFetchError(error),
    };
  }
}

function describeFetchError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Unknown keep-alive error.";
  }

  const cause = error.cause;
  if (cause instanceof Error && cause.message) {
    return `${error.message}: ${cause.message}`;
  }

  if (cause && typeof cause === "object" && "message" in cause && typeof cause.message === "string") {
    return `${error.message}: ${cause.message}`;
  }

  return error.message;
}

function toKoreanDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

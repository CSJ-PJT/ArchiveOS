export type AccessLogEntry = {
  id: number;
  occurred_at: string;
  actor: string;
  role: string;
  event_type: string;
  route: string;
  request_path: string;
  client_ip: string;
  user_agent: string | null;
  referer: string | null;
};

export type AccessRouteSummary = {
  route: string;
  count: number;
  last_seen: string | null;
};

export type ActiveVisitor = {
  client_ip: string;
  actor: string;
  role: string;
  last_seen: string;
  visits: number;
};

export type AccessLogSummary = {
  total: number;
  last_24_hours: number;
  unique_ips_24h: number;
  authenticated_24h: number;
  anonymous_24h: number;
  latest_at: string | null;
  byRoute: AccessRouteSummary[];
  activeVisitors: ActiveVisitor[];
  retentionDays: number;
};

type ApiEnvelope<T> = { data: T };

export async function getAccessLogs(limit = 200, route = "all") {
  const params = new URLSearchParams({ limit: String(limit) });
  if (route && route !== "all") params.set("route", route);
  const response = await request<ApiEnvelope<AccessLogEntry[]>>(`/api/security/access/logs?${params}`);
  return response.data;
}

export async function getAccessSummary() {
  const response = await request<ApiEnvelope<AccessLogSummary>>("/api/security/access/summary");
  return response.data;
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: "include", cache: "no-store" });
  if (!response.ok) {
    let message = `접속 기록 요청에 실패했습니다. HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch { /* keep status-based message */ }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

type NotificationResult = {
  channel: string;
  configured: boolean;
  sent: boolean;
  reason: string | null;
};

export async function sendOperationalNotification(
  message: string,
): Promise<{ ok: true; channel: "slack" } | { ok: false; reason: string }> {
  const baseUrl = process.env.ARCHIVEOS_AI_BASE_URL?.trim() || "http://localhost:4100";
  try {
    const response = await fetch(`${baseUrl}/api/notifications`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) return { ok: false, reason: `Spring notification API returned HTTP ${response.status}` };
    const payload = (await response.json()) as { data?: { results?: NotificationResult[] } };
    const slack = payload.data?.results?.find((result) => result.channel === "slack");
    if (slack?.sent) return { ok: true, channel: "slack" };
    return { ok: false, reason: slack?.reason || "Slack notification was not delivered" };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Spring notification API unavailable" };
  }
}

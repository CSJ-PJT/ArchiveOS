export async function sendDiscordMessage(content: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL?.trim();

  if (!webhookUrl) {
    return { ok: false, reason: "DISCORD_WEBHOOK_URL not configured" };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ content: content.slice(0, 1900) }),
    });

    if (!response.ok) {
      return { ok: false, reason: `Discord webhook failed ${response.status}: ${await response.text()}` };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Unknown Discord webhook failure",
    };
  }
}

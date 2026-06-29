# Slack notification cutover

ArchiveOS operational alerts are owned by the Spring Boot runtime. Node keeps API compatibility but delegates delivery to `POST /api/notifications`; it does not receive Slack credentials and no longer calls Discord.

## Configuration

- `SLACK_BOT_TOKEN`: Slack bot token. Keep it in local or deployment secrets only.
- `SLACK_CHANNEL`: channel ID or channel name. A channel ID is recommended.
- `SLACK_WEBHOOK_URL`: optional fallback for an Incoming Webhook installation.

Bot-token delivery uses Slack `chat.postMessage`. The bot must already belong to a private channel. For a public channel, either invite the bot or grant the Slack app the appropriate public-channel posting/join scopes.

## Runtime behavior

- Missing Slack configuration does not stop Spring Boot; delivery reports `configured=false`.
- Slack API failures do not terminate batch or scheduler processes; the result records the sanitized Slack error.
- Credentials are never returned by health, batch, or notification APIs.
- Existing `discord_*` database fields remain only as compatibility columns. New Java writes use `slack_sent` and `slack_skipped_reason`.

## Verification

```text
POST /api/notifications
Content-Type: application/json

{"message":"ArchiveOS notification test"}
```

Confirm the first result has `channel=slack`, `configured=true`, and `sent=true`.

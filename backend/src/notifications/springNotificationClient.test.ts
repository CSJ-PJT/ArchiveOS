import assert from "node:assert/strict";
import { sendOperationalNotification } from "./springNotificationClient.js";

const originalFetch = globalThis.fetch;
const originalToken = process.env.ARCHIVE_TOKEN_ADMIN_OPERATOR;
process.env.ARCHIVE_TOKEN_ADMIN_OPERATOR = "test-internal-token";

try {
  globalThis.fetch = async (_input, init) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("authorization"), "Bearer test-internal-token");
    assert.equal(headers.get("x-archive-source-system"), "archive-os");
    assert.equal(headers.get("x-archive-service-scope"), "admin:operate");
    return new Response(JSON.stringify({
      data: { results: [{ channel: "slack", configured: true, sent: true, reason: null }] },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  assert.deepEqual(await sendOperationalNotification("security test"), { ok: true, channel: "slack" });
  console.log("spring notification client tests passed");
} finally {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.ARCHIVE_TOKEN_ADMIN_OPERATOR;
  else process.env.ARCHIVE_TOKEN_ADMIN_OPERATOR = originalToken;
}

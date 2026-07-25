import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateAuthenticatedReadRelay,
  isAllowedAuthenticatedReadRelayPath,
  type HeaderRequest,
} from "./authenticatedReadRelay.js";

function request(method: string, headers: Record<string, string>): HeaderRequest {
  const normalized = new Map(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]));
  return { method, header: (name) => normalized.get(name.toLowerCase()) };
}

const valid = {
  authorization: "Bearer test-token-not-a-secret",
  "x-archive-source-system": "archive-os",
  "x-archive-service-scope": "authenticated:read",
};

test("allows only the three exact read-only route shapes", () => {
  assert.equal(isAllowedAuthenticatedReadRelayPath("/api/runtime/timeline?correlationId=CORR-1", "GET"), true);
  assert.equal(isAllowedAuthenticatedReadRelayPath("/api/live-flow/correlation/CORR-1", "GET"), true);
  assert.equal(isAllowedAuthenticatedReadRelayPath("/api/correlation-timeline/CORR-1", "GET"), true);
  assert.equal(isAllowedAuthenticatedReadRelayPath("/api/correlation-timeline/CORR-1/explain", "GET"), false);
  assert.equal(isAllowedAuthenticatedReadRelayPath("/api/correlation-timeline/CORR-1", "POST"), false);
  assert.equal(isAllowedAuthenticatedReadRelayPath("/api/runtime/timeline-write", "GET"), false);
  assert.equal(isAllowedAuthenticatedReadRelayPath("/api/live-flow/correlation-evil/CORR-1", "GET"), false);
  assert.equal(isAllowedAuthenticatedReadRelayPath("/api/live-flow/correlation/%2Fexplain", "GET"), false);
  assert.equal(isAllowedAuthenticatedReadRelayPath("/api/live-flow/correlation/../events", "GET"), false);
  assert.equal(isAllowedAuthenticatedReadRelayPath("https://untrusted.example/api/runtime/timeline", "GET"), false);
});

test("forwards canonical and legacy read scopes as canonical authenticated read", () => {
  for (const scope of ["authenticated:read", "runtime:read", "ledger:read"]) {
    const decision = evaluateAuthenticatedReadRelay(
      "/api/runtime/timeline?correlationId=CORR-1",
      request("GET", { ...valid, "x-archive-service-scope": scope }),
    );
    assert.equal(decision.forward, true);
    assert.equal(decision.headers?.source, "archive-os");
    assert.equal(decision.headers?.scope, "authenticated:read");
  }
});

test("accepts identical canonical and compatibility headers", () => {
  const decision = evaluateAuthenticatedReadRelay("/api/live-flow/correlation/CORR-1", request("GET", {
    ...valid,
    "x-archiveos-source-system": "ARCHIVE-OS",
    "x-archiveos-service-scope": "AUTHENTICATED:READ",
  }));
  assert.equal(decision.forward, true);
});

test("fails closed for missing, conflicting, or unauthorized read semantics", () => {
  const cases = [
    [{ ...valid, authorization: "" }, 401],
    [{ ...valid, "x-archive-source-system": "" }, 401],
    [{ ...valid, "x-archive-service-scope": "" }, 401],
    [{ ...valid, "x-archive-source-system": "archive-market" }, 403],
    [{ ...valid, "x-archive-service-scope": "runtime:write" }, 403],
    [{ ...valid, "x-archiveos-source-system": "archive-market" }, 403],
    [{ ...valid, "x-archiveos-service-scope": "ledger:read" }, 403],
  ] as const;
  for (const [headers, status] of cases) {
    const decision = evaluateAuthenticatedReadRelay(
      "/api/live-flow/correlation/CORR-1",
      request("GET", headers),
    );
    assert.equal(decision.forward, false);
    assert.equal(decision.status, status);
    assert.doesNotMatch(decision.error ?? "", /test-token-not-a-secret/);
  }
});

test("does not forward read credentials to writes or unrelated upstreams", () => {
  for (const [method, path] of [
    ["POST", "/api/correlation-timeline/CORR-1/explain"],
    ["POST", "/api/pm-inbox/item-1/resolve"],
    ["GET", "/api/managed-systems"],
    ["GET", "/api/runtime/timeline-extra"],
  ]) {
    const decision = evaluateAuthenticatedReadRelay(path, request(method, valid));
    assert.equal(decision.allowedPath, false);
    assert.equal(decision.forward, false);
    assert.equal(decision.headers, undefined);
  }
});

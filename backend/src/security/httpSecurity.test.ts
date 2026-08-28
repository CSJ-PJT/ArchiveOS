import assert from "node:assert/strict";
import { isArchiveOsAdminServiceRequest, rejectCrossOriginMutation, requiresAdminRead, securityAlertClientIp, securityHeaders } from "./httpSecurity.js";

assert.equal(requiresAdminRead("GET", "/api/local-actions/projects"), true);
assert.equal(requiresAdminRead("GET", "/api/batch/jobs"), false);
assert.equal(requiresAdminRead("GET", "/api/batch/executions"), false);
assert.equal(requiresAdminRead("GET", "/api/batch/executions/42"), false);
assert.equal(requiresAdminRead("GET", "/api/batch/internal-config"), true);
assert.equal(requiresAdminRead("GET", "/api/batches/latest"), false);
assert.equal(requiresAdminRead("POST", "/api/batch/jobs"), false);
assert.equal(isArchiveOsAdminServiceRequest({ header: (name: string) => ({
  authorization: "Bearer internal-test-token",
  "x-archive-source-system": "archive-os",
  "x-archive-service-scope": "admin:operate",
}[name]) } as never), true);
assert.equal(isArchiveOsAdminServiceRequest({ header: (name: string) => ({
  authorization: "Bearer internal-test-token",
  "x-archive-source-system": "untrusted-service",
  "x-archive-service-scope": "admin:operate",
}[name]) } as never), false);

const headers = new Map<string, string>();
securityHeaders(
  { path: "/api/health" } as never,
  { setHeader: (name: string, value: string) => headers.set(name, value) } as never,
  () => undefined,
);
assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
assert.equal(headers.get("X-Frame-Options"), "DENY");
assert.equal(headers.get("Cache-Control"), "no-store");

let status = 0;
let nextCalled = false;
let rejectedIp = "";
rejectCrossOriginMutation(
  new Set(["https://archiveos.kr"]),
  {
    method: "POST",
    path: "/api/auth/login",
    socket: { remoteAddress: "172.18.0.1" },
    header: (name: string) => name === "origin" ? "https://evil.example" : name === "x-real-ip" ? "203.0.113.77" : undefined,
  } as never,
  { status: (value: number) => { status = value; return { json: () => undefined }; } } as never,
  () => { nextCalled = true; },
  (event) => { rejectedIp = event.clientIp; },
);
assert.equal(status, 403);
assert.equal(nextCalled, false);
assert.equal(rejectedIp, "203.0.113.77");
assert.equal(securityAlertClientIp({ socket: { remoteAddress: "198.51.100.5" }, header: () => "203.0.113.88" } as never), "198.51.100.5");

console.log("http security tests passed");

import assert from "node:assert/strict";
import { rejectCrossOriginMutation, requiresAdminRead, securityHeaders } from "./httpSecurity.js";

assert.equal(requiresAdminRead("GET", "/api/local-actions/projects"), true);
assert.equal(requiresAdminRead("GET", "/api/batch/executions/42"), true);
assert.equal(requiresAdminRead("GET", "/api/batches/latest"), false);
assert.equal(requiresAdminRead("POST", "/api/batch/jobs"), false);

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
rejectCrossOriginMutation(
  new Set(["https://archiveos.kr"]),
  { method: "POST", header: () => "https://evil.example" } as never,
  { status: (value: number) => { status = value; return { json: () => undefined }; } } as never,
  () => { nextCalled = true; },
);
assert.equal(status, 403);
assert.equal(nextCalled, false);

console.log("http security tests passed");

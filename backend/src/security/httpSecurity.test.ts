import assert from "node:assert/strict";
import { createApiRateLimiter, isArchiveOsAdminServiceRequest, rejectCrossOriginMutation, requiresAdminRead, securityAlertClientIp, securityHeaders } from "./httpSecurity.js";

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
assert.equal(isArchiveOsAdminServiceRequest(undefined), false);
assert.equal(isArchiveOsAdminServiceRequest(null), false);

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

const limiter = createApiRateLimiter({ now: () => 1_000, generalLimit: 2 });
let limitedStatus = 0;
let limitedBody: Record<string, unknown> = {};
let allowedRequests = 0;
const limitedRequest = {
  method: "GET",
  path: "/api/ecosystem/summary",
  socket: { remoteAddress: "198.51.100.8" },
  header: () => undefined,
} as never;
const limitedResponse = {
  setHeader: () => undefined,
  status: (value: number) => {
    limitedStatus = value;
    return { json: (value: Record<string, unknown>) => { limitedBody = value; } };
  },
} as never;
limiter(limitedRequest, limitedResponse, () => { allowedRequests += 1; });
limiter(limitedRequest, limitedResponse, () => { allowedRequests += 1; });
limiter(limitedRequest, limitedResponse, () => { allowedRequests += 1; });
assert.equal(allowedRequests, 2);
assert.equal(limitedStatus, 429);
assert.equal(limitedBody.error, "Request rate limit exceeded.");

const passkeyLimiter = createApiRateLimiter({ now: () => 1_500, generalLimit: 20, loginLimit: 1 });
let passkeyAllowed = 0;
let passkeyStatus = 0;
const passkeyRequest = {
  method: "POST",
  path: "/api/auth/passkeys/authenticate/options",
  socket: { remoteAddress: "198.51.100.10" },
  header: () => undefined,
} as never;
const passkeyResponse = {
  setHeader: () => undefined,
  status: (value: number) => {
    passkeyStatus = value;
    return { json: () => undefined };
  },
} as never;
passkeyLimiter(passkeyRequest, passkeyResponse, () => { passkeyAllowed += 1; });
passkeyLimiter(passkeyRequest, passkeyResponse, () => { passkeyAllowed += 1; });
assert.equal(passkeyAllowed, 1);
assert.equal(passkeyStatus, 429);

const recoveryLimiter = createApiRateLimiter({ now: () => 1_700, generalLimit: 20, loginLimit: 1 });
let recoveryAllowed = 0;
let recoveryStatus = 0;
const recoveryRequest = {
  method: "POST",
  path: "/api/auth/recovery/password",
  socket: { remoteAddress: "198.51.100.11" },
  header: () => undefined,
} as never;
const recoveryResponse = {
  setHeader: () => undefined,
  status: (value: number) => {
    recoveryStatus = value;
    return { json: () => undefined };
  },
} as never;
recoveryLimiter(recoveryRequest, recoveryResponse, () => { recoveryAllowed += 1; });
recoveryLimiter(recoveryRequest, recoveryResponse, () => { recoveryAllowed += 1; });
assert.equal(recoveryAllowed, 1);
assert.equal(recoveryStatus, 429);

const ragLimiter = createApiRateLimiter({ now: () => 2_000, generalLimit: 10, ragLimit: 1 });
let ragAllowed = 0;
let ragStatus = 0;
const ragRequest = {
  method: "POST",
  path: "/api/rag/verification/plans",
  socket: { remoteAddress: "198.51.100.9" },
  header: () => undefined,
} as never;
const ragResponse = {
  setHeader: () => undefined,
  status: (value: number) => {
    ragStatus = value;
    return { json: () => undefined };
  },
} as never;
ragLimiter(ragRequest, ragResponse, () => { ragAllowed += 1; });
ragLimiter(ragRequest, ragResponse, () => { ragAllowed += 1; });
assert.equal(ragAllowed, 1);
assert.equal(ragStatus, 429);

console.log("http security tests passed");

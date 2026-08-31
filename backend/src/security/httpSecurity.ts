import { isIP } from "node:net";
import type { NextFunction, Request, Response } from "express";

const ADMIN_READ_EXACT = new Set([
  "/api/health/endpoints",
  "/api/local-actions/projects",
  "/api/local-runtime/status",
  "/api/runtime/public-access",
  "/api/runtime/version",
  "/api/security/status",
  "/api/audit/logs",
  "/api/audit/usage",
  "/api/auth/admin/users",
]);

const PUBLIC_BATCH_READ_EXACT = new Set([
  "/api/batch/jobs",
  "/api/batch/executions",
]);

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type ApiRateLimitOptions = {
  now?: () => number;
  windowMs?: number;
  generalLimit?: number;
  loginLimit?: number;
  ragLimit?: number;
  webhookLimit?: number;
};

export function requiresAdminRead(method: string, requestPath: string) {
  if (method.toUpperCase() !== "GET") return false;
  if (requestPath.startsWith("/api/batch/")) {
    return !PUBLIC_BATCH_READ_EXACT.has(requestPath) && !/^\/api\/batch\/executions\/\d+$/.test(requestPath);
  }
  return ADMIN_READ_EXACT.has(requestPath);
}

export function isArchiveOsAdminServiceRequest(request?: Pick<Request, "header"> | null) {
  if (!request || typeof request.header !== "function") return false;
  const authorization = request.header("authorization");
  const source = request.header("x-archive-source-system") ?? request.header("x-archiveos-source-system");
  const scope = request.header("x-archive-service-scope") ?? request.header("x-archiveos-service-scope");
  return Boolean(
    authorization?.startsWith("Bearer ")
      && source?.trim().toLowerCase() === "archive-os"
      && scope?.trim().toLowerCase() === "admin:operate",
  );
}

export function securityHeaders(request: Request, response: Response, next: NextFunction) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  if (request.path.startsWith("/api/")) response.setHeader("Cache-Control", "no-store");
  next();
}

export function createApiRateLimiter(options: ApiRateLimitOptions = {}) {
  const now = options.now ?? Date.now;
  const windowMs = positiveInteger(options.windowMs, 60_000);
  const limits = {
    general: positiveInteger(options.generalLimit, 1_800),
    login: positiveInteger(options.loginLimit, 20),
    rag: positiveInteger(options.ragLimit, 60),
    webhook: positiveInteger(options.webhookLimit, 600),
  };
  const buckets = new Map<string, RateLimitBucket>();
  let requestsSincePrune = 0;

  return (request: Request, response: Response, next: NextFunction) => {
    if (!request.path.startsWith("/api/")) {
      next();
      return;
    }

    const policy = apiRateLimitPolicy(request.method, request.path, limits);
    const timestamp = now();
    const key = `${policy.name}:${securityAlertClientIp(request)}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= timestamp) {
      bucket = { count: 0, resetAt: timestamp + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    const remaining = Math.max(policy.limit - bucket.count, 0);
    const retryAfterSeconds = Math.max(Math.ceil((bucket.resetAt - timestamp) / 1_000), 1);
    response.setHeader("RateLimit-Limit", String(policy.limit));
    response.setHeader("RateLimit-Remaining", String(remaining));
    response.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1_000)));

    requestsSincePrune += 1;
    if (requestsSincePrune >= 1_000 || buckets.size > 10_000) {
      requestsSincePrune = 0;
      for (const [storedKey, storedBucket] of buckets) {
        if (storedBucket.resetAt <= timestamp) buckets.delete(storedKey);
      }
    }

    if (bucket.count > policy.limit) {
      response.setHeader("Retry-After", String(retryAfterSeconds));
      response.status(429).json({ error: "Request rate limit exceeded.", retryAfterSeconds });
      return;
    }

    next();
  };
}

function apiRateLimitPolicy(method: string, requestPath: string, limits: Record<"general" | "login" | "rag" | "webhook", number>) {
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod === "POST" && (
    requestPath === "/api/auth/login"
    || requestPath.startsWith("/api/auth/recovery/")
    || requestPath === "/api/auth/passkeys/authenticate/options"
    || requestPath === "/api/auth/passkeys/authenticate"
  )) return { name: "login", limit: limits.login };
  if (normalizedMethod === "POST" && requestPath === "/api/mail/webhooks/resend") return { name: "webhook", limit: limits.webhook };
  if (requestPath === "/api/rag/ask" || requestPath === "/api/rag/search" || requestPath.startsWith("/api/rag/verification/")) {
    return { name: "rag", limit: limits.rag };
  }
  return { name: "general", limit: limits.general };
}

function positiveInteger(value: number | undefined, fallback: number) {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

export function rejectCrossOriginMutation(
  allowedOrigins: ReadonlySet<string>,
  request: Request,
  response: Response,
  next: NextFunction,
  onRejected?: (event: { clientIp: string; method: string; path: string; origin: string }) => void,
) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method.toUpperCase())) {
    next();
    return;
  }
  const origin = request.header("origin");
  if (origin && !allowedOrigins.has(origin)) {
    onRejected?.({
      clientIp: securityAlertClientIp(request),
      method: request.method.toUpperCase(),
      path: request.path || "/",
      origin,
    });
    response.status(403).json({ error: "Cross-origin mutation is not allowed." });
    return;
  }
  next();
}

export function securityAlertClientIp(request: Request) {
  const remote = normalizeIp(request.socket?.remoteAddress);
  if (remote && isTrustedProxy(remote)) {
    const realIp = normalizeIp(request.header("x-real-ip"));
    if (realIp) return realIp;
    const forwarded = request.header("x-forwarded-for");
    if (forwarded) {
      for (const candidate of forwarded.split(",")) {
        const normalized = normalizeIp(candidate);
        if (normalized) return normalized;
      }
    }
  }
  return remote ?? "0.0.0.0";
}

function normalizeIp(raw: string | undefined) {
  if (!raw) return null;
  let value = raw.trim();
  if (value.startsWith("::ffff:")) value = value.slice(7);
  if (value.startsWith("[") && value.includes("]")) value = value.slice(1, value.indexOf("]"));
  if (isIP(value)) return value;
  const colon = value.lastIndexOf(":");
  if (colon > 0 && value.indexOf(":") === colon && /^\d+$/.test(value.slice(colon + 1))) {
    value = value.slice(0, colon);
  }
  return isIP(value) ? value : null;
}

function isTrustedProxy(value: string) {
  if (value === "127.0.0.1" || value === "::1") return true;
  if (value.startsWith("10.") || value.startsWith("192.168.") || value.startsWith("169.254.")) return true;
  const match = /^172\.(\d{1,3})\./.exec(value);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
  const lower = value.toLowerCase();
  return lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:");
}

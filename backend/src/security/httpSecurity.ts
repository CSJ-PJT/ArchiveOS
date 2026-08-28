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
  "/api/batch/jobs",
  "/api/batch/executions",
]);

export function requiresAdminRead(method: string, requestPath: string) {
  if (method.toUpperCase() !== "GET") return false;
  return ADMIN_READ_EXACT.has(requestPath) || requestPath.startsWith("/api/batch/executions/");
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

export function rejectCrossOriginMutation(
  allowedOrigins: ReadonlySet<string>,
  request: Request,
  response: Response,
  next: NextFunction,
) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method.toUpperCase())) {
    next();
    return;
  }
  const origin = request.header("origin");
  if (origin && !allowedOrigins.has(origin)) {
    response.status(403).json({ error: "Cross-origin mutation is not allowed." });
    return;
  }
  next();
}

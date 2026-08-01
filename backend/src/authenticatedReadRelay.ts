const AUTHENTICATED_READ_SCOPES = new Map<string, "authenticated:read">([
  ["authenticated:read", "authenticated:read"],
  ["runtime:read", "authenticated:read"],
  ["ledger:read", "authenticated:read"],
]);

export type HeaderRequest = {
  method?: string;
  header?: (name: string) => unknown;
};

export type AuthenticatedReadRelayDecision = {
  allowedPath: boolean;
  forward: boolean;
  status?: 401 | 403;
  error?: string;
  headers?: {
    authorization: string;
    source: "archive-os";
    scope: "authenticated:read";
  };
};

function value(request: HeaderRequest, name: string) {
  const raw = request.header?.(name);
  return raw == null ? "" : String(raw).trim();
}

function compatibleHeader(request: HeaderRequest, canonical: string, legacy: string) {
  const canonicalValue = value(request, canonical);
  const legacyValue = value(request, legacy);
  const conflict = Boolean(
    canonicalValue
    && legacyValue
    && canonicalValue.toLowerCase() !== legacyValue.toLowerCase(),
  );
  return {
    conflict,
    value: canonicalValue || legacyValue,
    presented: Boolean(canonicalValue || legacyValue),
  };
}

function isSingleSafePathSegment(segment: string) {
  if (!segment || segment === "." || segment === "..") return false;
  try {
    const decoded = decodeURIComponent(segment);
    return !decoded.includes("/") && !decoded.includes("\\");
  } catch {
    return false;
  }
}

export function isAllowedAuthenticatedReadRelayPath(path: string, method = "GET") {
  if (method.toUpperCase() !== "GET") return false;
  let target: URL;
  try {
    target = new URL(path, "http://archiveos-ai.internal");
  } catch {
    return false;
  }
  if (target.origin !== "http://archiveos-ai.internal") return false;
  if (target.pathname === "/api/runtime/timeline") return true;
  for (const prefix of ["/api/live-flow/correlation/", "/api/correlation-timeline/"]) {
    if (!target.pathname.startsWith(prefix)) continue;
    return isSingleSafePathSegment(target.pathname.slice(prefix.length));
  }
  return false;
}

export function evaluateAuthenticatedReadRelay(
  path: string,
  request: HeaderRequest,
): AuthenticatedReadRelayDecision {
  const allowedPath = isAllowedAuthenticatedReadRelayPath(path, request.method);
  if (!allowedPath) return { allowedPath: false, forward: false };

  const authorization = value(request, "authorization");
  const source = compatibleHeader(request, "X-Archive-Source-System", "X-ArchiveOS-Source-System");
  const scope = compatibleHeader(request, "X-Archive-Service-Scope", "X-ArchiveOS-Service-Scope");
  const authAttempted = Boolean(authorization || source.presented || scope.presented);
  if (!authAttempted) return { allowedPath: true, forward: false };

  if (source.conflict || scope.conflict) {
    return { allowedPath: true, forward: false, status: 403, error: "Conflicting authentication headers." };
  }
  if (!authorization.startsWith("Bearer ") || !authorization.slice("Bearer ".length).trim() || !source.value || !scope.value) {
    return { allowedPath: true, forward: false, status: 401, error: "Authenticated read credentials are incomplete." };
  }
  if (source.value.toLowerCase() !== "archive-os") {
    return { allowedPath: true, forward: false, status: 403, error: "Authenticated read source is not permitted." };
  }
  const canonicalScope = AUTHENTICATED_READ_SCOPES.get(scope.value.toLowerCase());
  if (!canonicalScope) {
    return { allowedPath: true, forward: false, status: 403, error: "Authenticated read scope is not permitted." };
  }
  return {
    allowedPath: true,
    forward: true,
    headers: {
      authorization,
      source: "archive-os",
      scope: canonicalScope,
    },
  };
}

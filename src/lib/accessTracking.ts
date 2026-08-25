const routes = new Set(["dashboard", "services", "operations", "finance", "records", "mail", "settings"]);
let started = false;
let lastKey = "";
let lastSentAt = 0;

export function startAccessTracking() {
  if (started || typeof window === "undefined") return;
  started = true;

  const schedule = () => window.setTimeout(() => void sendVisit(), 0);
  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);

  window.history.pushState = ((...args: Parameters<History["pushState"]>) => {
    originalPushState(...args);
    schedule();
  }) as History["pushState"];

  window.history.replaceState = ((...args: Parameters<History["replaceState"]>) => {
    originalReplaceState(...args);
    schedule();
  }) as History["replaceState"];

  window.addEventListener("popstate", schedule);
  window.addEventListener("hashchange", schedule);
  schedule();
}

async function sendVisit() {
  const route = routeFromLocation();
  const requestPath = `${window.location.pathname}${window.location.hash || ""}`;
  const key = `${route}|${requestPath}`;
  const now = Date.now();
  if (key === lastKey && now - lastSentAt < 1500) return;
  lastKey = key;
  lastSentAt = now;

  try {
    await fetch("/api/security/access/visit", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ route, requestPath }),
    });
  } catch {
    // Access telemetry must never block or degrade the operator console.
  }
}

function routeFromLocation() {
  const hash = window.location.hash.replace(/^#\/?/, "").split(/[/?]/, 1)[0]?.toLowerCase() ?? "";
  if (hash && routes.has(hash)) return hash;
  if (!hash) return "root";
  return "unknown";
}

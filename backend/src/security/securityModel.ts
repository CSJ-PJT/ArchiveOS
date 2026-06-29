import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Request } from "express";
import { sendOperationalNotification } from "../notifications/springNotificationClient.js";
import type {
  ApprovedDeviceRecord,
  ProtectedEndpointDescriptor,
  SecurityRoleCapability,
  SecurityStatus,
} from "./types.js";

const deviceRegistryPath = path.resolve(process.cwd(), "data", "approved-devices.json");

const protectedEndpoints: ProtectedEndpointDescriptor[] = [
  {
    method: "POST",
    path: "/api/tasks",
    action: "task_create",
    requiredRole: "pm",
    enforcement: "report_only",
    description: "PM task creation is prepared for ngrok OAuth + ArchiveOS role checks.",
  },
  {
    method: "PATCH",
    path: "/api/tasks/:id",
    action: "task_update",
    requiredRole: "pm",
    enforcement: "report_only",
    description: "PM task metadata changes will require PM role once enforcement is enabled.",
  },
  {
    method: "POST",
    path: "/api/tasks/:id/decision",
    action: "task_decision",
    requiredRole: "pm",
    enforcement: "report_only",
    description: "Approve, reject, hold, and retry decisions are PM-gated CUD actions.",
  },
  {
    method: "POST",
    path: "/api/tasks/:id/retry",
    action: "task_retry",
    requiredRole: "pm",
    enforcement: "report_only",
    description: "Retry requests are PM-gated and do not directly execute Codex or MCP.",
  },
  {
    method: "POST",
    path: "/api/queue/run-once",
    action: "queue_run_once",
    requiredRole: "admin",
    enforcement: "report_only",
    description: "Queue run-once is instruction/state generation only and is prepared for admin gating.",
  },
];

const viewerCapability: SecurityRoleCapability = {
  role: "viewer",
  canRead: true,
  canDecide: false,
  canRetry: false,
  canAdmin: false,
  description: "Dashboard, Operators, Knowledge, Timeline, KPI, and Mesh read-only access.",
};

const pmCapability: SecurityRoleCapability = {
  role: "pm",
  canRead: true,
  canDecide: true,
  canRetry: true,
  canAdmin: false,
  description: "Viewer permissions plus PM decision recording, task approval, and retry requests.",
};

const adminCapability: SecurityRoleCapability = {
  role: "admin",
  canRead: true,
  canDecide: true,
  canRetry: true,
  canAdmin: true,
  description: "PM permissions plus runtime configuration, device approval, and integration management.",
};

export async function getSecurityStatus(request?: Request): Promise<SecurityStatus> {
  const provider = normalizeNullable(process.env.NGROK_OAUTH_PROVIDER);
  const allowedEmails = parseCsvEnv(process.env.NGROK_ALLOWED_EMAILS);
  const allowedDomains = parseCsvEnv(process.env.NGROK_ALLOWED_DOMAINS);
  const oauthConfigured = Boolean(provider && (allowedEmails.length > 0 || allowedDomains.length > 0));
  const authenticationEnabled = readBooleanEnv("ARCHIVEOS_AUTHENTICATION_ENABLED", oauthConfigured);
  const deviceApprovalEnabled = readBooleanEnv("ARCHIVEOS_DEVICE_APPROVAL_ENABLED", oauthConfigured);
  const pmRoleEnabled = readBooleanEnv("ARCHIVEOS_PM_ROLE_ENABLED", true);
  const adminRoleEnabled = readBooleanEnv("ARCHIVEOS_ADMIN_ROLE_ENABLED", true);
  const devices = await loadApprovedDevices();
  const requestIdentity = request ? readRequestIdentity(request) : null;
  const lastSeenAt = latestDate(devices.map((device) => device.last_seen));
  const lastLogin = requestIdentity?.email ?? null;
  const warnings: string[] = [];

  if (!provider) {
    warnings.push("NGROK_OAUTH_PROVIDER is not configured.");
  }

  if (!allowedEmails.length && !allowedDomains.length) {
    warnings.push("No allowed ngrok OAuth emails or domains are configured.");
  }

  if (deviceApprovalEnabled && devices.filter((device) => device.approved).length === 0) {
    warnings.push("Device Approval is enabled but no approved devices are registered yet.");
  }

  if (!pmRoleEnabled) {
    warnings.push("PM role is disabled, so PM CUD actions should remain unavailable.");
  }

  const securityLevel = determineSecurityLevel({
    authenticationEnabled,
    oauthConfigured,
    deviceApprovalEnabled,
    approvedDevicesCount: devices.filter((device) => device.approved).length,
  });

  return {
    checkedAt: new Date().toISOString(),
    authentication: {
      enabled: authenticationEnabled,
      provider,
      status: authenticationEnabled ? "enabled" : "disabled",
    },
    oauth: {
      provider,
      allowedEmailsConfigured: allowedEmails.length > 0,
      allowedDomainsConfigured: allowedDomains.length > 0,
      allowedEmailCount: allowedEmails.length,
      allowedDomainCount: allowedDomains.length,
      status: oauthConfigured ? "configured" : "not_configured",
    },
    deviceApproval: {
      enabled: deviceApprovalEnabled,
      status: deviceApprovalEnabled ? "enabled" : "disabled",
      approvedDevicesCount: devices.filter((device) => device.approved).length,
      knownDevicesCount: devices.length,
      lastSeenAt,
      lastLogin,
    },
    roles: {
      viewer: viewerCapability,
      pm: { ...pmCapability, enabled: pmRoleEnabled },
      admin: { ...adminCapability, enabled: adminRoleEnabled },
    },
    protectedEndpoints,
    securityLevel,
    warnings,
    notes: [
      "Current implementation is a readiness layer. Protected endpoint enforcement is report-only until ngrok OAuth headers and approved devices are confirmed.",
      "Read-only screens remain available; PM Decision and Task Queue CUD actions are marked for PM/admin protection.",
      "No webhook URL, service role key, or absolute local vault path is exposed.",
    ],
  };
}

export function getProtectedEndpoints() {
  return protectedEndpoints;
}

export async function notifySecurityEvent(input: {
  type:
    | "new_device_detected"
    | "device_approved"
    | "device_denied"
    | "pm_decision_executed"
    | "admin_configuration_changed";
  title: string;
  summary: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}) {
  const lines = [
    "[ArchiveOS Security]",
    `Event: ${input.title}`,
    `Type: ${input.type}`,
    `Summary: ${input.summary}`,
  ];

  if (input.metadata) {
    const metadataLines = Object.entries(input.metadata)
      .filter(([, value]) => value !== undefined && value !== null && String(value).trim().length > 0)
      .map(([key, value]) => `- ${key}: ${String(value)}`);
    if (metadataLines.length) {
      lines.push("", "Metadata:", ...metadataLines);
    }
  }

  const result = await sendOperationalNotification(lines.join("\n"));
  if (!result.ok) {
    console.warn(`[archiveos-security] Slack notification skipped: ${result.reason}`);
  }
  return result;
}

export async function recordSeenDevice(input: {
  deviceId: string;
  deviceName: string;
  approved?: boolean;
  approvedBy?: string | null;
}) {
  const devices = await loadApprovedDevices();
  const now = new Date().toISOString();
  const existing = devices.find((device) => device.device_id === input.deviceId);

  if (existing) {
    existing.last_seen = now;
    if (input.approved !== undefined) {
      existing.approved = input.approved;
      existing.approved_by = input.approvedBy ?? existing.approved_by;
      existing.approved_at = input.approved ? now : null;
    }
  } else {
    devices.push({
      device_id: input.deviceId,
      device_name: input.deviceName,
      first_seen: now,
      last_seen: now,
      approved: Boolean(input.approved),
      approved_by: input.approvedBy ?? null,
      approved_at: input.approved ? now : null,
    });
  }

  await saveApprovedDevices(devices);
  return devices;
}

function readRequestIdentity(request: Request) {
  const email =
    request.header("x-forwarded-email") ??
    request.header("x-auth-request-email") ??
    request.header("ngrok-auth-user-email") ??
    request.header("x-user-email") ??
    null;
  const userAgent = request.header("user-agent") ?? "unknown-device";
  const forwardedFor = request.header("x-forwarded-for") ?? request.ip ?? "unknown-ip";
  const deviceId = createHash("sha256").update(`${email ?? "anonymous"}:${forwardedFor}:${userAgent}`).digest("hex").slice(0, 16);
  return {
    email,
    deviceId,
    deviceName: `${email ?? "anonymous"} / ${userAgent.slice(0, 48)}`,
  };
}

async function loadApprovedDevices(): Promise<ApprovedDeviceRecord[]> {
  try {
    const raw = await fs.readFile(deviceRegistryPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isApprovedDeviceRecord) : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function saveApprovedDevices(devices: ApprovedDeviceRecord[]) {
  await fs.mkdir(path.dirname(deviceRegistryPath), { recursive: true });
  await fs.writeFile(deviceRegistryPath, `${JSON.stringify(devices, null, 2)}\n`, "utf8");
}

function isApprovedDeviceRecord(value: unknown): value is ApprovedDeviceRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.device_id === "string" &&
    typeof candidate.device_name === "string" &&
    typeof candidate.first_seen === "string" &&
    typeof candidate.last_seen === "string" &&
    typeof candidate.approved === "boolean"
  );
}

function readBooleanEnv(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

function normalizeNullable(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function parseCsvEnv(value: string | undefined) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function latestDate(values: string[]) {
  const sorted = values.filter(Boolean).sort((left, right) => right.localeCompare(left));
  return sorted[0] ?? null;
}

function determineSecurityLevel(input: {
  authenticationEnabled: boolean;
  oauthConfigured: boolean;
  deviceApprovalEnabled: boolean;
  approvedDevicesCount: number;
}): SecurityStatus["securityLevel"] {
  if (!input.authenticationEnabled) return "open_read_only";
  if (!input.oauthConfigured) return "needs_setup";
  if (input.deviceApprovalEnabled && input.approvedDevicesCount === 0) return "needs_setup";
  if (input.oauthConfigured && input.deviceApprovalEnabled) return "protected";
  return "configured_read_only";
}

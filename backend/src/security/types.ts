export type ArchiveOsRole = "viewer" | "pm" | "admin";

export type ProtectedAction =
  | "task_create"
  | "task_update"
  | "task_decision"
  | "task_retry"
  | "queue_run_once";

export type SecurityStatusValue =
  | "configured"
  | "not_configured"
  | "enabled"
  | "disabled"
  | "protected"
  | "read_only"
  | "unknown";

export type ApprovedDeviceRecord = {
  device_id: string;
  device_name: string;
  first_seen: string;
  last_seen: string;
  approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
};

export type SecurityRoleCapability = {
  role: ArchiveOsRole;
  canRead: boolean;
  canDecide: boolean;
  canRetry: boolean;
  canAdmin: boolean;
  description: string;
};

export type ProtectedEndpointDescriptor = {
  method: "POST" | "PATCH";
  path: string;
  action: ProtectedAction;
  requiredRole: ArchiveOsRole;
  enforcement: "report_only" | "enforced";
  description: string;
};

export type SecurityStatus = {
  checkedAt: string;
  authentication: {
    enabled: boolean;
    provider: string | null;
    status: SecurityStatusValue;
  };
  oauth: {
    provider: string | null;
    allowedEmailsConfigured: boolean;
    allowedDomainsConfigured: boolean;
    allowedEmailCount: number;
    allowedDomainCount: number;
    status: SecurityStatusValue;
  };
  deviceApproval: {
    enabled: boolean;
    status: SecurityStatusValue;
    approvedDevicesCount: number;
    knownDevicesCount: number;
    lastSeenAt: string | null;
    lastLogin: string | null;
  };
  roles: {
    viewer: SecurityRoleCapability;
    pm: SecurityRoleCapability & { enabled: boolean };
    admin: SecurityRoleCapability & { enabled: boolean };
  };
  protectedEndpoints: ProtectedEndpointDescriptor[];
  securityLevel: "open_read_only" | "configured_read_only" | "protected" | "needs_setup";
  warnings: string[];
  notes: string[];
};

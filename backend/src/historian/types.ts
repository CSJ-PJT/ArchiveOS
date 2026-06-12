export type ExportResult = {
  enabled: boolean;
  success: boolean;
  notePath?: string;
  reason?: string;
};

export type DecisionExportInput = {
  title: string;
  decision: "Approved" | "Rejected" | "Recorded";
  reason?: string | null;
  task?: string | null;
  builderResult?: string | null;
  reviewerResult?: string | null;
  dashboardUrl?: string | null;
  decisionType?: string | null;
  createdAt?: string | null;
};

export type IncidentExportInput = {
  title: string;
  severity: "info" | "warning" | "error";
  summary: string;
  impact?: string | null;
  recommendedAction?: string | null;
  createdAt?: string | null;
};

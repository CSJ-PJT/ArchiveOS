export type BatchType = "nightly_review" | "daily_report";

export type BatchStatus = "completed" | "sent" | "skipped" | "failed";

export type OperationStatus = "normal" | "warning" | "problem";

export type QueueSummary = {
  inbox: number;
  processing: number;
  outbox: number;
  reviews: number;
};

export type OperatorSummary = {
  implementer: string;
  reviewer: string;
  loop: string;
  reviewerBridge: string;
};

export type BatchRun = {
  id: string;
  batch_type: BatchType;
  status: BatchStatus;
  target_date: string;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type NightlyReviewSummary = {
  date: string;
  operationStatus: OperationStatus;
  statusReason: string;
  queue: QueueSummary;
  latestInboxTask: string | null;
  latestBuilder: {
    task_id: string | null;
    status: string | null;
    result_name: string | null;
    finished_at: string | null;
    summary: string | null;
  } | null;
  latestReviewer: {
    reviewed_task_id: string | null;
    verdict: string | null;
    review_name: string | null;
    reviewed_at: string | null;
    summary: string | null;
  } | null;
  operators: OperatorSummary;
  warnings: string[];
  decisions: {
    count: number;
    recent: string[];
  };
  commands: {
    count: number;
    recent: string[];
  };
  summaryText: string;
};

export type DailyReportRecord = {
  target_date: string;
  status: OperationStatus;
  status_reason: string;
  runtime_summary: QueueSummary;
  latest_builder: NightlyReviewSummary["latestBuilder"];
  latest_reviewer: NightlyReviewSummary["latestReviewer"];
  operator_summary: OperatorSummary;
  warnings: string[];
  decisions_count: number;
  commands_count: number;
  discord_sent: boolean;
  discord_skipped_reason: string | null;
  report_text: string;
};

export type DailyReportRow = DailyReportRecord & {
  id: string;
  created_at: string;
};

export type RuntimeSnapshotRow = {
  id: string;
  captured_at: string;
  inbox_count: number;
  processing_count: number;
  outbox_count: number;
  reviews_count: number;
  active_task: string | null;
  latest_builder: NightlyReviewSummary["latestBuilder"];
  latest_reviewer: NightlyReviewSummary["latestReviewer"];
  operators: OperatorSummary;
  warnings: string[];
  source: string;
};

export type BatchResult = {
  batch_type: BatchType;
  status: BatchStatus;
  target_date: string;
  summary: string;
  metadata: Record<string, unknown>;
  created_at?: string;
};

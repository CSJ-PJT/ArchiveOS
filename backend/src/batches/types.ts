export type BatchType = "nightly_review" | "daily_report";

export type BatchStatus = "completed" | "sent" | "skipped" | "failed";

export type QueueSummary = {
  inbox: number;
  processing: number;
  outbox: number;
  reviews: number;
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
  queue: QueueSummary;
  latestBuilder: {
    task_id: string | null;
    status: string | null;
    finished_at: string | null;
    summary: string | null;
  } | null;
  latestReviewer: {
    reviewed_task_id: string | null;
    verdict: string | null;
    reviewed_at: string | null;
    summary: string | null;
  } | null;
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

export type BatchResult = {
  batch_type: BatchType;
  status: BatchStatus;
  target_date: string;
  summary: string;
  metadata: Record<string, unknown>;
  created_at?: string;
};

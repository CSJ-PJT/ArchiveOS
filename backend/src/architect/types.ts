export type ArchitectReviewStatus = "pending" | "reviewed" | "warning" | "blocked";

export type ArchitectReviewInput = {
  targetType: "task" | "decision" | "result" | "incident" | "report" | string;
  targetRef: string;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
};

export type ArchitectFinding = {
  rule: string;
  severity: "info" | "warning" | "blocked";
  message: string;
  evidence?: string;
};

export type ArchitectRecommendation = {
  rule: string;
  message: string;
};

export type ArchitectReviewResult = {
  status: ArchitectReviewStatus;
  summary: string;
  findings: ArchitectFinding[];
  recommendations: ArchitectRecommendation[];
  relatedKnowledge: Array<{
    id: string;
    node_type: string;
    title: string;
    external_ref: string | null;
  }>;
};

export type ArchitectureReviewRow = {
  id: string;
  target_type: string;
  target_ref: string;
  status: ArchitectReviewStatus;
  summary: string | null;
  findings: ArchitectFinding[];
  recommendations: ArchitectRecommendation[];
  related_nodes: ArchitectReviewResult["relatedKnowledge"];
  created_at: string;
};

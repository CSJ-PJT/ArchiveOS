export type KpiRange = "today" | "7d" | "30d";

export type TrendPoint = {
  date: string;
  count: number;
};

export type KpiOverview = {
  range: KpiRange;
  generatedAt: string;
  productivity: {
    tasksCompleted: number | null;
    reviewsCompleted: number | null;
    decisionsRecorded: number | null;
    commandsRecorded: number | null;
    dailyReportsSent: number | null;
    nightlyReviewsCompleted: number | null;
  };
  quality: {
    reviewApproveCount: number | null;
    reviewRejectCount: number | null;
    reviewStopCount: number | null;
    approvalRate: number | null;
    architectReviewCount: number | null;
    architectWarningCount: number | null;
    architectBlockedCount: number | null;
  };
  runtime: {
    latestInbox: number | null;
    latestProcessing: number | null;
    latestOutbox: number | null;
    latestReviews: number | null;
    latestStatus: "healthy" | "warning" | "blocked" | "unknown";
    warningCount: number | null;
    loopDetectedRate: number | null;
  };
  knowledge: {
    totalNodes: number | null;
    totalEdges: number | null;
    nodesCreatedInRange: number | null;
    edgesCreatedInRange: number | null;
    obsidianExports: number | null;
    graphDensity: number | null;
  };
  trends: {
    dailyReports: TrendPoint[];
    decisions: TrendPoint[];
    knowledgeNodes: TrendPoint[];
    warnings: TrendPoint[];
  };
  notes: string[];
};

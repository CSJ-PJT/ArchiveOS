export type MeshAgentStatus =
  | "detected"
  | "not_detected"
  | "working"
  | "idle"
  | "warning"
  | "clear"
  | "blocked"
  | "pending"
  | "no_review"
  | "enabled"
  | "disabled";

export type MeshAgent = {
  id: string;
  label: string;
  role: string;
  status: MeshAgentStatus;
  source: "runtime" | "architect" | "historian" | "static";
  summary: string;
  metadata: Record<string, unknown>;
};

export type MeshLink = {
  from: string;
  to: string;
  type: string;
  label: string;
  strength: number;
  recent: boolean;
  source: "runtime" | "knowledge_graph" | "architect" | "historian" | "derived";
};

export type MeshInteraction = {
  time: string;
  from: string;
  to: string;
  type: string;
  summary: string;
  source: "runtime" | "knowledge_graph" | "architect" | "historian" | "derived";
};

export type MeshOverview = {
  agents: MeshAgent[];
  links: MeshLink[];
  recentInteractions: MeshInteraction[];
  health: {
    status: "healthy" | "warning" | "blocked";
    summary: string;
  };
};

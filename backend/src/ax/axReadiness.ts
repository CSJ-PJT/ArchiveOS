export type AxPhaseStatus = "implemented" | "partial" | "planned" | "blocked";

export type AxRoadmapPhase = {
  id: string;
  title: string;
  status: AxPhaseStatus;
  summary: string;
  capabilities: Array<{
    label: string;
    status: AxPhaseStatus;
    evidence: string;
  }>;
  risks: string[];
  nextActions: string[];
};

export type AxReadiness = {
  generatedAt: string;
  architectureCommit: string;
  architectureSource: string;
  score: number;
  grade: string;
  currentMode: "node_visibility_platform" | "spring_ai_target";
  targetMode: "spring_ai_ax_platform";
  summary: string;
  phases: AxRoadmapPhase[];
  guardrails: string[];
  recommendedNextStep: string;
};

const architectureCommit = "7ecbbb7b506d80d135cb31ba117d3b9c5015f96a";
const architectureSource = "docs/ARCHITECTURE_FULL.md";

const phases: AxRoadmapPhase[] = [
  {
    id: "phase-0",
    title: "Current ArchiveOS Operations Foundation",
    status: "implemented",
    summary: "ArchiveOS already provides PM visibility, runtime status, decisions, timeline, historian, knowledge graph, mesh, KPI, and Discord reporting.",
    capabilities: [
      { label: "PM visibility dashboard", status: "implemented", evidence: "Dashboard, Operators, Timeline, Mesh, KPI, Knowledge tabs" },
      { label: "Human-in-the-loop PM decisions", status: "implemented", evidence: "PM Task Queue and Decisions recording flow" },
      { label: "Operational memory", status: "implemented", evidence: "Historian, Obsidian Markdown export, Knowledge Graph MVP" },
      { label: "Discord operational reports", status: "implemented", evidence: "Nightly Review and Korean Daily Report batches" },
    ],
    risks: [
      "Current backend is Node/Express, while the AX target architecture introduces a Spring AI backend.",
      "Execution remains intentionally disabled in the UI; future automation must keep strict approval gates.",
    ],
    nextActions: [
      "Keep current Node/Express backend stable as the control plane.",
      "Treat Spring AI as an additive AI service module first, not a risky replacement.",
    ],
  },
  {
    id: "phase-1",
    title: "Spring AI Foundation",
    status: "planned",
    summary: "Add a separate Spring Boot + Spring AI service module for AI/RAG capabilities without disrupting the existing operations dashboard.",
    capabilities: [
      { label: "Spring Boot 3.x module", status: "planned", evidence: "Target architecture only" },
      { label: "Spring AI ChatModel", status: "planned", evidence: "No OpenAI API integration enabled in ArchiveOS UI" },
      { label: "EmbeddingModel", status: "planned", evidence: "No embedding pipeline active yet" },
      { label: "AI health endpoint", status: "planned", evidence: "Target endpoint: GET /api/health for archiveos-ai" },
    ],
    risks: [
      "OpenAI/API key handling must remain backend-only.",
      "Spring AI module should not gain direct Codex/MCP/shell execution privileges.",
    ],
    nextActions: [
      "Create a separate archiveos-ai service skeleton.",
      "Expose read-only health and capability status before enabling any AI call.",
    ],
  },
  {
    id: "phase-2",
    title: "Obsidian Knowledge Platform",
    status: "partial",
    summary: "Markdown export already exists; the AX target adds ingestion, chunking, incremental sync, embeddings, and RAG retrieval.",
    capabilities: [
      { label: "Obsidian Markdown export", status: "implemented", evidence: "Historian export writes Daily/Reports/Batches notes" },
      { label: "Markdown ingestion", status: "planned", evidence: "Target API: POST /api/obsidian/sync" },
      { label: "Incremental sync", status: "planned", evidence: "Target design uses path, modified time, and content hash" },
      { label: "RAG search / ask", status: "planned", evidence: "Target APIs: GET /api/rag/search, POST /api/rag/ask" },
    ],
    risks: [
      "Vault absolute paths must never be exposed to the frontend.",
      "RAG answers must cite source documents to stay useful for PM review.",
    ],
    nextActions: [
      "Add obsidian_documents and obsidian_chunks schema in a migration.",
      "Implement dry-run Obsidian sync before embedding generation.",
    ],
  },
  {
    id: "phase-3",
    title: "PostgreSQL + pgvector Schema",
    status: "planned",
    summary: "Add vector-ready document and chunk tables while preserving existing Supabase operational history tables.",
    capabilities: [
      { label: "obsidian_documents", status: "planned", evidence: "DDL defined in ARCHITECTURE_FULL.md" },
      { label: "obsidian_chunks", status: "planned", evidence: "DDL defined with vector(1536)" },
      { label: "pgvector extension readiness", status: "planned", evidence: "Not validated by current backend health" },
      { label: "Compatibility with existing Knowledge Graph", status: "planned", evidence: "Needs relationship mapping from chunks to knowledge_nodes" },
    ],
    risks: [
      "Supabase pgvector extension must be enabled explicitly.",
      "Embedding dimension must match the selected model before production ingestion.",
    ],
    nextActions: [
      "Add schema SQL for pgvector tables behind an explicit migration step.",
      "Add read-only readiness checks for pgvector and document table presence.",
    ],
  },
];

export function getAxRoadmap() {
  return {
    architectureCommit,
    architectureSource,
    phases,
  };
}

export function getAxReadiness(): AxReadiness {
  const total = phases.flatMap((phase) => phase.capabilities);
  const implemented = total.filter((item) => item.status === "implemented").length;
  const partial = total.filter((item) => item.status === "partial").length;
  const score = Math.round(((implemented + partial * 0.5) / total.length) * 100);

  return {
    generatedAt: new Date().toISOString(),
    architectureCommit,
    architectureSource,
    score,
    grade: getGrade(score),
    currentMode: "node_visibility_platform",
    targetMode: "spring_ai_ax_platform",
    summary:
      "ArchiveOS is productionizing its current PM visibility and operational memory foundation while preparing a separate Spring AI/RAG service layer.",
    phases,
    guardrails: [
      "No OpenAI API calls from the frontend.",
      "No Codex, MCP, shell, deployment, or process execution from the UI.",
      "Service role keys, webhook URLs, OpenAI keys, and local vault paths remain backend-only.",
      "Human PM approval remains required before any future CUD or deployment workflow is considered complete.",
    ],
    recommendedNextStep:
      "Implement the Spring AI service as a separate additive module with health/readiness endpoints before enabling RAG ingestion or AI answers.",
  };
}

function getGrade(score: number) {
  if (score >= 90) return "A";
  if (score >= 80) return "B+";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}

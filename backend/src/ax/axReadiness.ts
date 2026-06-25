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
    status: "partial",
    summary: "A separate Spring Boot archiveos-ai module now exists with backend-only environment wiring and a health endpoint; direct AI calls remain disabled until keys and approval gates are configured.",
    capabilities: [
      { label: "Spring Boot 3.x module", status: "implemented", evidence: "archiveos-ai Gradle module" },
      { label: "Spring AI ChatModel", status: "planned", evidence: "No OpenAI API integration enabled in ArchiveOS UI" },
      { label: "EmbeddingModel", status: "planned", evidence: "No embedding pipeline active yet" },
      { label: "AI health endpoint", status: "implemented", evidence: "archiveos-ai GET /api/health" },
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
    summary: "Markdown export, ingestion, chunking, incremental sync, and keyword-safe RAG retrieval now exist; embedding generation is prepared but not activated without backend-only AI configuration.",
    capabilities: [
      { label: "Obsidian Markdown export", status: "implemented", evidence: "Historian export writes Daily/Reports/Batches notes" },
      { label: "Markdown ingestion", status: "implemented", evidence: "POST /api/obsidian/sync" },
      { label: "Incremental sync", status: "implemented", evidence: "file_path, last_modified_at, and content_hash" },
      { label: "RAG search / ask", status: "partial", evidence: "GET /api/rag/search and POST /api/rag/ask return grounded references without LLM calls" },
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
    status: "implemented",
    summary: "Vector-ready Obsidian document and chunk tables are defined alongside existing Supabase operational history tables.",
    capabilities: [
      { label: "obsidian_documents", status: "implemented", evidence: "supabase/schema.sql" },
      { label: "obsidian_chunks", status: "implemented", evidence: "supabase/schema.sql with embedding vector(1536)" },
      { label: "pgvector extension readiness", status: "implemented", evidence: "create extension if not exists vector" },
      { label: "Compatibility with existing Knowledge Graph", status: "partial", evidence: "RAG references coexist with knowledge_nodes; explicit graph edges are a next increment" },
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
      "Enable backend-only embedding generation after OpenAI/Spring AI credentials, pgvector migration, and approval guardrails are verified in the target environment.",
  };
}

function getGrade(score: number) {
  if (score >= 90) return "A";
  if (score >= 80) return "B+";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}

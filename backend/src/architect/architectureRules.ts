import type { ArchitectFinding, ArchitectRecommendation, ArchitectReviewInput } from "./types.js";

type RuleResult = {
  findings: ArchitectFinding[];
  recommendations: ArchitectRecommendation[];
};

export function evaluateArchitectureRules(input: ArchitectReviewInput): RuleResult {
  const text = normalize(`${input.title}\n${input.description}\n${JSON.stringify(input.metadata ?? {})}`);
  const findings: ArchitectFinding[] = [];
  const recommendations: ArchitectRecommendation[] = [];

  if (hasAny(text, ["dashboard"]) && hasAny(text, ["control", "execute", "start process", "stop process", "start/stop"])) {
    findings.push({
      rule: "boundary_risk",
      severity: "warning",
      message: "Dashboard should remain read-only. Move control behavior to Operators or Settings.",
      evidence: "dashboard + control/execute/process wording",
    });
    recommendations.push({
      rule: "boundary_risk",
      message: "Split visibility UI from process-control design. Keep Dashboard as PM overview only.",
    });
  }

  if (hasAny(text, ["arbitrary shell", "direct mcp execution", "mcp command execution", "codex control", "codex direct control"])) {
    findings.push({
      rule: "execution_risk",
      severity: "blocked",
      message: "Execution control must remain disabled or explicitly allowlisted.",
      evidence: "execution-control wording",
    });
    recommendations.push({
      rule: "execution_risk",
      message: "Keep this task metadata-only or route future execution through a separately reviewed allowlist.",
    });
  }

  if (hasAny(text, ["historian", "knowledge"]) && hasAny(text, ["bidirectional sync", "graph database", "embeddings", "vector search"])) {
    findings.push({
      rule: "knowledge_scope_risk",
      severity: "warning",
      message: "Out of MVP scope. Keep metadata-only Knowledge Graph.",
      evidence: "knowledge/historian + advanced retrieval/sync wording",
    });
    recommendations.push({
      rule: "knowledge_scope_risk",
      message: "Store conservative metadata links first. Defer embeddings, graph DB, and bidirectional Obsidian sync.",
    });
  }

  if (hasAny(text, ["webhook url exposed", "service role frontend", "service_role frontend", "vault path frontend", "secret frontend"])) {
    findings.push({
      rule: "security_risk",
      severity: "blocked",
      message: "Secret/path exposure risk.",
      evidence: "secret or local path exposure wording",
    });
    recommendations.push({
      rule: "security_risk",
      message: "Keep service role keys, webhook URLs, and absolute vault paths backend-only.",
    });
  }

  const touchedSurfaces = ["dashboard", "operators", "timeline", "settings"].filter((surface) => text.includes(surface));
  if (touchedSurfaces.length >= 3) {
    findings.push({
      rule: "responsibility_split",
      severity: "warning",
      message: "One task appears to modify multiple PM surfaces. Decompose responsibilities.",
      evidence: touchedSurfaces.join(", "),
    });
    recommendations.push({
      rule: "responsibility_split",
      message: "Split into separate Dashboard, Operators, Timeline, and Settings tasks unless a single data contract requires one change.",
    });
  }

  const isValidationRelevant = hasAny(text, ["batch", "report", "runtime", "backend", "frontend", "dashboard"]);
  const hasValidation =
    hasAny(text, ["npm run build"]) &&
    hasAny(text, ["typecheck"]) &&
    hasAny(text, ["backend build", "npm run build"]);
  if (isValidationRelevant && !hasValidation) {
    findings.push({
      rule: "missing_validation",
      severity: "warning",
      message: "Runtime/report/backend task should include frontend build, backend typecheck, and backend build validation.",
      evidence: "validation commands not found in task text",
    });
    recommendations.push({
      rule: "missing_validation",
      message: "Add validation: npm run build, cd backend && npm run typecheck, cd backend && npm run build.",
    });
  }

  return { findings, recommendations };
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

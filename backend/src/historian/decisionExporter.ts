import { frontmatter } from "./markdown.js";
import { sanitizeFileName, writeVaultNote } from "./obsidianVault.js";
import type { DecisionExportInput, ExportResult } from "./types.js";

export async function exportDecisionToObsidian(decision: DecisionExportInput): Promise<ExportResult> {
  const date = toDateString(decision.createdAt);
  const title = decision.title || "decision";
  const content = [
    frontmatter({
      type: "decision",
      date,
      source: "archiveos",
      decision_type: decision.decisionType ?? decision.decision.toLowerCase(),
      tags: ["archiveos", "decision"],
    }),
    `# Decision - ${title}`,
    "",
    "## 결정",
    decision.decision,
    "",
    "## 사유",
    decision.reason || "기록된 사유 없음",
    "",
    "## 연결",
    `- Task: ${decision.task ?? "없음"}`,
    `- Builder Result: ${decision.builderResult ?? "없음"}`,
    `- Reviewer Result: ${decision.reviewerResult ?? "없음"}`,
    `- Dashboard: ${decision.dashboardUrl ?? "미설정"}`,
    "",
  ].join("\n");

  return writeVaultNote("Decisions", `${date}-${sanitizeFileName(title)}`, content);
}

function toDateString(value: string | null | undefined) {
  return (value ? new Date(value) : new Date()).toISOString().slice(0, 10);
}

import { frontmatter } from "./markdown.js";
import { sanitizeFileName, writeVaultNote } from "./obsidianVault.js";
import type { ExportResult, IncidentExportInput } from "./types.js";

export async function exportIncidentToObsidian(incident: IncidentExportInput): Promise<ExportResult> {
  const date = toDateString(incident.createdAt);
  const content = [
    frontmatter({
      type: "incident",
      date,
      source: "archiveos",
      severity: incident.severity,
      tags: ["archiveos", "incident"],
    }),
    `# Incident - ${incident.title}`,
    "",
    "## 요약",
    incident.summary,
    "",
    "## 영향",
    incident.impact || "기록된 영향 없음",
    "",
    "## 권장 조치",
    incident.recommendedAction || "기록된 권장 조치 없음",
    "",
  ].join("\n");

  return writeVaultNote("Incidents", `${date}-${sanitizeFileName(incident.title)}`, content);
}

function toDateString(value: string | null | undefined) {
  return (value ? new Date(value) : new Date()).toISOString().slice(0, 10);
}

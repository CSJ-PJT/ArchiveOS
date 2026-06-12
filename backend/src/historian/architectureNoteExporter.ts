import { frontmatter } from "./markdown.js";
import { sanitizeFileName, writeVaultNote } from "./obsidianVault.js";
import type { ExportResult } from "./types.js";

export async function exportArchitectureNoteToObsidian(input: {
  title: string;
  content: string;
  createdAt?: string | null;
}): Promise<ExportResult> {
  const date = (input.createdAt ? new Date(input.createdAt) : new Date()).toISOString().slice(0, 10);
  const markdown = [
    frontmatter({
      type: "architecture_note",
      date,
      source: "archiveos",
      tags: ["archiveos", "architecture"],
    }),
    `# Architecture - ${input.title}`,
    "",
    input.content,
    "",
  ].join("\n");

  return writeVaultNote("Architecture", `${date}-${sanitizeFileName(input.title)}`, markdown);
}

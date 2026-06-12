import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ExportResult } from "./types.js";

const allowedFolders = new Set(["Daily", "Decisions", "Incidents", "Architecture", "Reports", "Batches"]);

export function isHistorianConfigured() {
  return Boolean(process.env.ARCHIVEOS_OBSIDIAN_VAULT_PATH?.trim());
}

export function sanitizeFileName(value: string) {
  const clean = value
    .normalize("NFKD")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return clean.slice(0, 96) || "archiveos-note";
}

export async function writeVaultNote(folder: string, fileName: string, content: string): Promise<ExportResult> {
  const root = process.env.ARCHIVEOS_OBSIDIAN_VAULT_PATH?.trim();

  if (!root) {
    return {
      enabled: false,
      success: false,
      reason: "ARCHIVEOS_OBSIDIAN_VAULT_PATH not configured",
    };
  }

  if (!allowedFolders.has(folder)) {
    return {
      enabled: true,
      success: false,
      reason: "Invalid historian folder",
    };
  }

  const safeFileName = `${sanitizeFileName(fileName)}.md`;
  const vaultRoot = path.resolve(root);
  const targetDirectory = path.resolve(vaultRoot, folder);
  const targetPath = path.resolve(targetDirectory, safeFileName);
  const relativePath = path.relative(vaultRoot, targetPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return {
      enabled: true,
      success: false,
      reason: "Resolved note path escapes configured vault",
    };
  }

  await mkdir(targetDirectory, { recursive: true });
  await writeFile(targetPath, content, "utf-8");

  return {
    enabled: true,
    success: true,
    notePath: normalizeRelativePath(relativePath),
  };
}

function normalizeRelativePath(value: string) {
  return value.split(path.sep).join("/");
}

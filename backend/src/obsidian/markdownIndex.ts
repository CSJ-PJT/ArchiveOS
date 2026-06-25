import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { ObsidianDocumentRow, ObsidianSyncResult, RagSearchResult } from "./types.js";

const defaultChunkSize = Number(process.env.OBSIDIAN_CHUNK_SIZE ?? 1200);
const defaultChunkOverlap = Number(process.env.OBSIDIAN_CHUNK_OVERLAP ?? 160);
const maxSearchLimit = 20;

export function isObsidianIngestionConfigured() {
  return Boolean(process.env.OBSIDIAN_VAULT_PATH?.trim() || process.env.ARCHIVEOS_OBSIDIAN_VAULT_PATH?.trim());
}

export function getConfiguredVaultPath() {
  return process.env.OBSIDIAN_VAULT_PATH?.trim() || process.env.ARCHIVEOS_OBSIDIAN_VAULT_PATH?.trim() || null;
}

export async function syncObsidianVault(): Promise<ObsidianSyncResult> {
  const vault = getConfiguredVaultPath();
  if (!vault) {
    return {
      enabled: false,
      scanned: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      deletedChunks: 0,
      reason: "OBSIDIAN_VAULT_PATH not configured",
    };
  }

  const vaultRoot = path.resolve(vault);
  const supabaseAdmin = await getSupabaseAdmin();
  const files = await listMarkdownFiles(vaultRoot);
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let deletedChunks = 0;

  for (const filePath of files) {
    const relativePath = normalizePath(path.relative(vaultRoot, filePath));
    const content = await readFile(filePath, "utf-8");
    const fileStat = await stat(filePath);
    const contentHash = sha256(content);
    const title = extractTitle(content, relativePath);

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("obsidian_documents")
      .select("*")
      .eq("file_path", relativePath)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    if (existing && (existing as ObsidianDocumentRow).content_hash === contentHash) {
      skipped += 1;
      continue;
    }

    const { data: document, error: upsertError } = await supabaseAdmin
      .from("obsidian_documents")
      .upsert(
        {
          file_path: relativePath,
          title,
          content_hash: contentHash,
          last_modified_at: fileStat.mtime.toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "file_path" },
      )
      .select("*")
      .single();

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    if (existing) updated += 1;
    else created += 1;

    const { error: deleteError, count } = await supabaseAdmin
      .from("obsidian_chunks")
      .delete({ count: "exact" })
      .eq("document_id", (document as ObsidianDocumentRow).id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    deletedChunks += count ?? 0;

    const chunks = chunkMarkdown(content, {
      filePath: relativePath,
      title,
      chunkSize: defaultChunkSize,
      overlap: defaultChunkOverlap,
    });

    if (chunks.length) {
      const { error: insertError } = await supabaseAdmin.from("obsidian_chunks").insert(
        chunks.map((chunk, index) => ({
          document_id: (document as ObsidianDocumentRow).id,
          chunk_index: index,
          heading: chunk.heading,
          chunk_text: chunk.text,
          metadata: {
            file_path: relativePath,
            title,
            chunk_size: chunk.text.length,
            embedding_status: process.env.OPENAI_API_KEY ? "pending" : "not_configured",
          },
        })),
      );

      if (insertError) {
        throw new Error(insertError.message);
      }
    }
  }

  return {
    enabled: true,
    scanned: files.length,
    created,
    updated,
    skipped,
    deletedChunks,
  };
}

export async function listObsidianDocuments(limit = 100) {
  const supabaseAdmin = await getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("obsidian_documents")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 500));

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function searchRagChunks(query: string, limit = 10): Promise<RagSearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const supabaseAdmin = await getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("obsidian_chunks")
    .select("id, heading, chunk_text, metadata, document:obsidian_documents(title,file_path)")
    .textSearch("chunk_text", cleanQuery, { type: "websearch", config: "simple" })
    .limit(Math.min(Math.max(limit, 1), maxSearchLimit));

  if (error) {
    return fallbackSearch(cleanQuery, limit);
  }

  return (data ?? []).map((row: any) => ({
    title: row.document?.title ?? row.metadata?.title ?? "Untitled",
    path: row.document?.file_path ?? row.metadata?.file_path ?? "unknown",
    heading: row.heading ?? null,
    chunkText: row.chunk_text,
    score: 1,
  }));
}

export async function answerRagQuestion(question: string) {
  const references = await searchRagChunks(question, 5);
  const answer = references.length
    ? [
        "ArchiveOS RAG MVP는 현재 검색 기반 근거를 반환합니다.",
        "LLM 답변 생성은 Spring AI/OpenAI 키가 구성된 이후 활성화됩니다.",
        `검색된 근거 ${references.length}개를 기준으로 질문과 관련된 문서를 확인하세요.`,
      ].join(" ")
    : "관련 Obsidian 지식 청크를 찾지 못했습니다. 먼저 /api/obsidian/sync를 실행해 문서를 인덱싱하세요.";

  return {
    answer,
    references: references.map((item) => ({
      title: item.title,
      path: item.path,
      heading: item.heading,
      score: item.score,
    })),
  };
}

export function chunkMarkdown(
  content: string,
  options: { filePath: string; title: string; chunkSize?: number; overlap?: number },
) {
  const chunkSize = Math.max(options.chunkSize ?? defaultChunkSize, 200);
  const overlap = Math.min(Math.max(options.overlap ?? defaultChunkOverlap, 0), Math.floor(chunkSize / 2));
  const sections = splitMarkdownSections(content);
  const chunks: Array<{ heading: string | null; text: string }> = [];

  for (const section of sections) {
    const text = section.text.trim();
    if (!text) continue;
    if (text.length <= chunkSize) {
      chunks.push(section);
      continue;
    }

    let index = 0;
    while (index < text.length) {
      const end = Math.min(index + chunkSize, text.length);
      chunks.push({
        heading: section.heading,
        text: text.slice(index, end).trim(),
      });
      if (end >= text.length) break;
      index = Math.max(end - overlap, index + 1);
    }
  }

  return chunks.map((chunk) => ({
    heading: chunk.heading,
    text: chunk.text,
  }));
}

async function fallbackSearch(query: string, limit: number): Promise<RagSearchResult[]> {
  const supabaseAdmin = await getSupabaseAdmin();
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const { data, error } = await supabaseAdmin
    .from("obsidian_chunks")
    .select("id, heading, chunk_text, metadata, document:obsidian_documents(title,file_path)")
    .limit(500);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row: any) => {
      const haystack = `${row.heading ?? ""} ${row.chunk_text}`.toLowerCase();
      const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
      return { row, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.min(Math.max(limit, 1), maxSearchLimit))
    .map(({ row, score }) => ({
      title: row.document?.title ?? row.metadata?.title ?? "Untitled",
      path: row.document?.file_path ?? row.metadata?.file_path ?? "unknown",
      heading: row.heading ?? null,
      chunkText: row.chunk_text,
      score,
    }));
}

async function listMarkdownFiles(root: string) {
  const files: string[] = [];

  async function walk(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".obsidian") || entry.name === ".git" || entry.name === "node_modules") continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        files.push(fullPath);
      }
    }
  }

  await walk(root);
  return files;
}

function splitMarkdownSections(content: string) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const sections: Array<{ heading: string | null; text: string }> = [];
  let heading: string | null = null;
  let buffer: string[] = [];
  let inCodeBlock = false;

  function flush() {
    const text = buffer.join("\n").trim();
    if (text) sections.push({ heading, text });
    buffer = [];
  }

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      buffer.push(line);
      continue;
    }

    const headingMatch = !inCodeBlock ? /^(#{1,6})\s+(.+)$/.exec(line) : null;
    if (headingMatch) {
      flush();
      heading = headingMatch[2].trim();
      buffer.push(line);
      continue;
    }

    buffer.push(line);
  }

  flush();
  return sections.length ? sections : [{ heading: null, text: content }];
}

function extractTitle(content: string, filePath: string) {
  const firstHeading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (firstHeading) return firstHeading.slice(0, 200);
  return path.basename(filePath, path.extname(filePath));
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizePath(value: string) {
  return value.split(path.sep).join("/");
}

async function getSupabaseAdmin() {
  const module = await import("../lib/supabaseAdmin.js");
  return module.supabaseAdmin;
}

export type ObsidianDocumentRow = {
  id: number;
  file_path: string;
  title: string | null;
  content_hash: string;
  last_modified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ObsidianChunkRow = {
  id: number;
  document_id: number;
  chunk_index: number;
  heading: string | null;
  chunk_text: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ObsidianSyncResult = {
  enabled: boolean;
  scanned: number;
  created: number;
  updated: number;
  skipped: number;
  deletedChunks: number;
  reason?: string;
};

export type RagSearchResult = {
  title: string;
  path: string;
  heading: string | null;
  chunkText: string;
  score: number;
};

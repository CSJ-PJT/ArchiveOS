export {
  answerRagQuestion,
  chunkMarkdown,
  getConfiguredVaultPath,
  isObsidianIngestionConfigured,
  listObsidianDocuments,
  searchRagChunks,
  syncObsidianVault,
} from "./markdownIndex.js";

export type { ObsidianDocumentRow, ObsidianSyncResult, RagSearchResult } from "./types.js";

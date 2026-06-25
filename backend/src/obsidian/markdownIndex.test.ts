import assert from "node:assert/strict";
import { chunkMarkdown } from "./markdownIndex.js";

const content = [
  "# ArchiveOS AX",
  "",
  "첫 번째 섹션입니다.",
  "",
  "## Phase 1",
  "",
  "Spring AI Foundation 내용을 검증합니다.",
  "",
  "```ts",
  "const value = 'code block';",
  "```",
].join("\n");

const chunks = chunkMarkdown(content, {
  filePath: "ArchiveOS/ARCHITECTURE_FULL.md",
  title: "ArchiveOS AX",
  chunkSize: 80,
  overlap: 10,
});

assert.ok(chunks.length >= 2, "markdown should split into multiple chunks");
assert.equal(chunks[0].heading, "ArchiveOS AX");
assert.ok(chunks.some((chunk) => chunk.heading === "Phase 1"));
assert.ok(chunks.some((chunk) => chunk.text.includes("code block")), "code block text should be preserved");

console.log("markdownIndex.test passed");

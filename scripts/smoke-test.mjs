import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "docs/ARCHITECTURE_FULL.md",
  "docs/AX_IMPLEMENTATION_STATUS.md",
  "backend/src/obsidian/markdownIndex.ts",
  "backend/src/ax/axReadiness.ts",
  "archiveos-ai/build.gradle",
  "docker-compose.yml",
];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    throw new Error(`Missing required AX file: ${file}`);
  }
}

const architecture = readFileSync("docs/ARCHITECTURE_FULL.md", "utf-8");
for (const phrase of ["Execution Policy (Mandatory)", "Phase 1 - Spring AI Foundation", "Phase 2 - Obsidian Knowledge Platform", "Phase 3 - Database Schema"]) {
  if (!architecture.includes(phrase)) {
    throw new Error(`ARCHITECTURE_FULL.md missing phrase: ${phrase}`);
  }
}

console.log("archiveos smoke-test passed");

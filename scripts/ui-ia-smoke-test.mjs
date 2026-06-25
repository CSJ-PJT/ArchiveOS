import { readFileSync } from "node:fs";

const appShell = readFileSync("src/app/AppShell.tsx", "utf-8");
const navigation = readFileSync("src/app/navigation.ts", "utf-8");
const styles = readFileSync("src/styles.css", "utf-8");

for (const label of ["Overview", "Workflows", "Knowledge", "History", "Settings"]) {
  if (!navigation.includes(label)) {
    throw new Error(`Missing final navigation label: ${label}`);
  }
}

for (const removed of ["Dashboard", "Decisions", "Operators", "Timeline", "Mesh", "KPI"]) {
  if (navigation.includes(`label: "${removed}"`)) {
    throw new Error(`Legacy top-level tab still present: ${removed}`);
  }
}

for (const token of [
  "--color-bg",
  "--color-surface",
  "--color-surface-elevated",
  "--color-surface-muted",
  "--color-border",
  "--color-border-strong",
  "--color-text",
  "--color-text-muted",
  "--color-text-subtle",
  "--color-primary",
  "--color-primary-contrast",
  "--color-success",
  "--color-warning",
  "--color-danger",
  "--color-info",
  "--color-overlay",
  "--color-focus-ring",
]) {
  if (!styles.includes(token)) {
    throw new Error(`Missing semantic theme token: ${token}`);
  }
}

if (!appShell.includes("<OverviewPage") || !appShell.includes("<WorkflowsPage") || !appShell.includes("<KnowledgePage")) {
  throw new Error("AppShell is not composing the new page structure.");
}

console.log("archiveos ui information-architecture smoke-test passed");

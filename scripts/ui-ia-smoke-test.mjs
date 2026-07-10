import { readFileSync } from "node:fs";

const appShell = readFileSync("src/app/AppShell.tsx", "utf-8");
const navigation = readFileSync("src/app/navigation.ts", "utf-8");
const styles = readFileSync("src/styles.css", "utf-8");
const overview = readFileSync("src/pages/OverviewPage.tsx", "utf-8");
const knowledge = readFileSync("src/pages/KnowledgePage.tsx", "utf-8");
const backendApi = readFileSync("src/lib/backendApi.ts", "utf-8");
const sidebar = readFileSync("src/components/shared/Sidebar.tsx", "utf-8");
const overviewViewModel = readFileSync("src/lib/viewModels/overview.ts", "utf-8");
const ledgerApprovals = readFileSync("src/pages/LedgerApprovalsPage.tsx", "utf-8");
const ecosystemPage = readFileSync("src/pages/EcosystemPage.tsx", "utf-8");
const liveFlowPage = readFileSync("src/pages/LiveFlowPage.tsx", "utf-8");

for (const label of ["Overview", "Agents", "Ecosystem", "Live Flow", "Ecosystem Finance", "Managed Systems", "Workflows", "Ledger Approvals", "Knowledge", "History", "Batch", "RPA", "Settings"]) {
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

if (!appShell.includes("<OverviewPage") || !appShell.includes("<AgentsPage") || !appShell.includes("<WorkflowsPage") || !appShell.includes("<KnowledgePage") || !appShell.includes("<BatchPage") || !appShell.includes("<RpaPage")) {
  throw new Error("AppShell is not composing the new page structure.");
}

for (const contract of ["sidebar-nav", "aria-current", "System Health", "Active Agents", "Critical Alerts", "Runtime Flow", "Attention Required"]) {
  if (!appShell.includes(contract) && !overview.includes(contract) && !sidebar.includes(contract)) {
    throw new Error(`Operator console contract missing: ${contract}`);
  }
}

if (!backendApi.includes("getAiRuntime") || !appShell.includes("getAiRuntime")) {
  throw new Error("Spring AI runtime data is not wired through the frontend API layer.");
}

for (const approvalContract of ["getExternalApprovals", "decideExternalApproval", "Ledger Approval Queue", "Admin unlock or PM session is required", "RAG / Fallback Evidence", "callback_status"]) {
  if (!backendApi.includes(approvalContract) && !appShell.includes(approvalContract) && !ledgerApprovals.includes(approvalContract)) {
    throw new Error(`Ledger approval UI/API contract missing: ${approvalContract}`);
  }
}

for (const ecosystemContract of ["getEcosystemSummary", "getEcosystemTopology", "runEcosystemDryRun", "Ecosystem Overview", "Market → Nexus → Logistics → Ledger → ArchiveOS", "Callback Outbox"]) {
  if (!backendApi.includes(ecosystemContract) && !appShell.includes(ecosystemContract) && !ecosystemPage.includes(ecosystemContract) && !ledgerApprovals.includes(ecosystemContract)) {
    throw new Error(`Ecosystem Control Tower contract missing: ${ecosystemContract}`);
  }
}

for (const liveFlowContract of ["getLiveFlowSummary", "refreshLiveFlow", "Live Flow / Operational Twin", "Synthetic Runtime Events", "No real customer, payment, account, or financial data"]) {
  if (!backendApi.includes(liveFlowContract) && !appShell.includes(liveFlowContract) && !liveFlowPage.includes(liveFlowContract)) {
    throw new Error(`Live Flow contract missing: ${liveFlowContract}`);
  }
}

for (const forbidden of [
  "Embeddings\" value={data.knowledge?.totalNodes",
  "Vector Index\" value={data.knowledge?.totalEdges",
  "References\" value={data.knowledge?.totalEdges",
  "Last RAG Check\" value={data.axReadiness?.generatedAt",
  "pgvector\" value={overview.memorySummary.ragReady",
]) {
  if (overview.includes(forbidden) || knowledge.includes(forbidden)) {
    throw new Error(`Forbidden inferred Spring AI metric mapping found: ${forbidden}`);
  }
}

if (overviewViewModel.includes("summary.failed + endpointHealth.summary.missing + endpointHealth.summary.error")) {
  throw new Error("Endpoint failures are double-counted in the Overview critical alert KPI.");
}

if (!overviewViewModel.includes("affectedEndpointServices")) {
  throw new Error("Overview must summarize endpoint failures by affected service.");
}

console.log("archiveos ui information-architecture smoke-test passed");

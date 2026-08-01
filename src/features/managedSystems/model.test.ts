import assert from "node:assert/strict";
import test from "node:test";
import type { ManagedSystemSummary } from "../../lib/backendApi";
import {
  canManagePmInbox,
  executePmInboxAction,
  managedSystemsUiState,
  selectCoreManagedSystems,
} from "./model.ts";

function system(systemId: string, status = "normal"): ManagedSystemSummary {
  return {
    systemId,
    name: systemId,
    type: "PLATFORM",
    environment: "local",
    provider: "local",
    status,
    statusReason: `${status} evidence`,
    lastCheckedAt: status === "not_connected" ? null : "2026-07-25T00:00:00Z",
    serviceCount: 1,
    normalServiceCount: status === "normal" ? 1 : 0,
    degradedServiceCount: status === "degraded" ? 1 : 0,
    downServiceCount: 0,
    pendingApprovalCount: 0,
    openIncidentCount: status === "degraded" ? 1 : 0,
    latestWorkflowId: null,
    latestAuditEventId: null,
    latestWorkLogId: null,
    publicUrl: null,
    repository: null,
    source: "archiveos",
  };
}

test("selects exactly the five Runtime systems and canonicalizes Logistics", () => {
  const result = selectCoreManagedSystems([
    system("archive-os"),
    system("archive-market", "degraded"),
    system("archive-nexus", "not_connected"),
    system("archive-logitics"),
    system("archive-ledger"),
    system("archive-world"),
    system("atlas-platform"),
    system("deepstake"),
  ]);
  assert.deepEqual(result.map((item) => item.systemId), [
    "archive-os",
    "archive-market",
    "archive-nexus",
    "archive-logistics",
    "archive-ledger",
  ]);
  assert.equal(result.some((item) => item.systemId === "archive-logitics"), false);
  assert.equal(result.find((item) => item.systemId === "archive-market")?.status, "degraded");
  assert.equal(result.find((item) => item.systemId === "archive-nexus")?.status, "not_connected");
});

test("PM Inbox mutations are Admin-only in the UI model", () => {
  assert.equal(canManagePmInbox("PUBLIC"), false);
  assert.equal(canManagePmInbox("PM"), false);
  assert.equal(canManagePmInbox("ADMIN"), true);
});

test("loading, empty, error, and ready states remain distinct", () => {
  assert.equal(managedSystemsUiState(true, false), "loading");
  assert.equal(managedSystemsUiState(false, false), "empty");
  assert.equal(managedSystemsUiState(false, false, "unavailable"), "error");
  assert.equal(managedSystemsUiState(false, true), "ready");
});

test("successful Admin actions refresh the current PM Inbox view", async () => {
  const calls: string[] = [];
  const result = await executePmInboxAction("item-1", "resolve", {
    acknowledge: async (id) => { calls.push(`ack:${id}`); },
    resolve: async (id) => { calls.push(`resolve:${id}`); },
  }, async () => { calls.push("refresh"); });

  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["resolve:item-1", "refresh"]);
});

test("failed Admin actions preserve the current view and expose the error", async () => {
  let refreshCount = 0;
  const existingState = Object.freeze({ id: "item-1", status: "open" });
  const result = await executePmInboxAction("item-1", "acknowledge", {
    acknowledge: async () => { throw new Error("write failed"); },
    resolve: async () => undefined,
  }, async () => { refreshCount += 1; });

  assert.equal(result.ok, false);
  assert.equal(result.message, "write failed");
  assert.equal(refreshCount, 0);
  assert.deepEqual(existingState, { id: "item-1", status: "open" });
});

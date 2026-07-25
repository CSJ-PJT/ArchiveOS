import { canonicalManagedSystemId } from "../../app/navigation.ts";
import type { ManagedSystemSummary } from "../../lib/backendApi";

export const CORE_MANAGED_SYSTEM_IDS = [
  "archive-os",
  "archive-market",
  "archive-nexus",
  "archive-logistics",
  "archive-ledger",
] as const;

export function selectCoreManagedSystems(systems: ManagedSystemSummary[]) {
  const byCanonicalId = new Map(
    systems.map((system) => [canonicalManagedSystemId(system.systemId), {
      ...system,
      systemId: canonicalManagedSystemId(system.systemId) ?? system.systemId,
    }]),
  );
  return CORE_MANAGED_SYSTEM_IDS
    .map((id) => byCanonicalId.get(id))
    .filter((system): system is ManagedSystemSummary => Boolean(system));
}

export function canManagePmInbox(role: string) {
  return role === "ADMIN";
}

export async function executePmInboxAction(
  id: string,
  action: "acknowledge" | "resolve",
  clients: {
    acknowledge: (id: string) => Promise<unknown>;
    resolve: (id: string) => Promise<unknown>;
  },
  refresh: () => Promise<void>,
) {
  try {
    if (action === "acknowledge") await clients.acknowledge(id);
    else await clients.resolve(id);
    await refresh();
    return {
      ok: true as const,
      message: `PM Inbox 항목을 ${action === "acknowledge" ? "확인" : "해결"} 처리했습니다.`,
    };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : `PM Inbox ${action} 처리에 실패했습니다.`,
    };
  }
}

export function managedSystemsUiState(loading: boolean, hasData: boolean, error?: string | null) {
  if (loading && !hasData) return "loading";
  if (!hasData && error) return "error";
  if (!hasData) return "empty";
  return "ready";
}

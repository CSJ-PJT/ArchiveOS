import { useEffect, useState, type ReactNode } from "react";
import type { AppData } from "../app/AppShell";
import { SectionCard } from "../components/shared/SectionCard";
import { StatusBadge } from "../components/shared/StatusBadge";
import { useTheme, type ThemeMode } from "../theme/ThemeProvider";
import { formatTimeAgo, stringifyMeta } from "./pageUtils";
import { getOpenAiUsage, loginAdmin, logoutAdmin, type OpenAiUsageSummary, type PlatformRole } from "../lib/backendApi";

const sections = [
  "Appearance",
  "Backend",
  "Spring AI",
  "OpenAI Usage",
  "Database",
  "Obsidian",
  "Docker",
  "MCP",
  "Slack",
  "Public Access",
  "Security",
  "Build Information",
] as const;

export function SettingsPage({
  data,
  onRefresh,
  backendOrigin,
}: {
  data: AppData;
  onRefresh: () => void;
  backendOrigin: string;
}) {
  const [open, setOpen] = useState<string>("Appearance");
  const { theme, setTheme } = useTheme();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [requestedRole, setRequestedRole] = useState<Exclude<PlatformRole, "PUBLIC">>("ADMIN");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [openAiUsage, setOpenAiUsage] = useState<OpenAiUsageSummary | null>(null);
  const [openAiUsageBusy, setOpenAiUsageBusy] = useState(false);
  const [openAiUsageError, setOpenAiUsageError] = useState<string | null>(null);

  async function loadOpenAiUsage() {
    if (data.auth.role !== "ADMIN") return;
    setOpenAiUsageBusy(true);
    setOpenAiUsageError(null);
    try { setOpenAiUsage(await getOpenAiUsage()); }
    catch (error) { setOpenAiUsageError(error instanceof Error ? error.message : String(error)); }
    finally { setOpenAiUsageBusy(false); }
  }

  useEffect(() => {
    if (open === "OpenAI Usage" && data.auth.role === "ADMIN" && !openAiUsage && !openAiUsageBusy) void loadOpenAiUsage();
  }, [data.auth.role, open, openAiUsage, openAiUsageBusy]);

  async function login() {
    setAuthBusy(true); setAuthError(null);
    try { await loginAdmin(password, requestedRole, username); setPassword(""); await onRefresh(); }
    catch (error) { setAuthError(error instanceof Error ? error.message : String(error)); }
    finally { setAuthBusy(false); }
  }

  async function logout() {
    setAuthBusy(true);
    try { await logoutAdmin(); await onRefresh(); }
    finally { setAuthBusy(false); }
  }

  if (data.auth.role === "PUBLIC") {
    return <div className="page-stack"><SectionCard title="운영자 로그인" eyebrow="PUBLIC 세션에서는 설정을 변경할 수 없습니다">
      <div className="decision-panel">
        <select value={requestedRole} onChange={(event) => setRequestedRole(event.target.value as Exclude<PlatformRole, "PUBLIC">)}>
          <option value="OPERATOR">운영자</option><option value="PM">PM</option><option value="ADMIN">관리자</option>
        </select>
        <input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="admin" />
        <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="관리자 비밀번호" />
        {authError ? <div className="empty-state error-state">{authError}</div> : null}
        <button className="button button-primary" type="button" onClick={login} disabled={authBusy || !password}>{authBusy ? "로그인 중..." : "로그인"}</button>
      </div>
    </SectionCard></div>;
  }

  return (
    <div className="page-stack">
      <SectionCard
        title="Settings"
        eyebrow="Runtime and integration diagnostics"
        action={<button className="button button-secondary" type="button" onClick={onRefresh}>Refresh</button>}
      >
        <div className="box-row"><strong>{data.auth.role}</strong><span>{data.auth.actor}</span><button className="button button-secondary" type="button" onClick={logout} disabled={authBusy}>Logout</button></div>
        <div className="settings-list">
          <SettingsRow title="Appearance" status={theme} open={open === "Appearance"} onToggle={() => setOpen(open === "Appearance" ? "" : "Appearance")}>
            <div className="theme-grid">
              {(["dark", "light", "system"] as ThemeMode[]).map((mode) => (
                <button className={`theme-choice ${theme === mode ? "active" : ""}`} key={mode} type="button" onClick={() => setTheme(mode)}>
                  {mode}
                </button>
              ))}
            </div>
          </SettingsRow>

          <SettingsRow title="Backend" status={data.endpointHealth ? "connected" : "unknown"} open={open === "Backend"} onToggle={() => setOpen(open === "Backend" ? "" : "Backend")}>
            <KeyValue label="Backend origin" value={backendOrigin} />
            <KeyValue label="Endpoint healthy" value={`${data.endpointHealth?.summary.online ?? 0}/${data.endpointHealth?.summary.total ?? 0}`} />
            <pre>{stringifyMeta(data.endpointHealth?.summary || data.errors)}</pre>
          </SettingsRow>

          <SettingsRow title="Spring AI" status={data.platformReadiness ? "connected" : "unknown"} open={open === "Spring AI"} onToggle={() => setOpen(open === "Spring AI" ? "" : "Spring AI")}>
            <KeyValue label="AX readiness score" value={data.platformReadiness ? `${data.platformReadiness.score} (${data.platformReadiness.grade})` : "Unknown"} />
            <KeyValue label="Runtime status" value={data.aiRuntime?.status || "unknown"} />
            <KeyValue label="ChatModel" value={data.aiRuntime ? `${data.aiRuntime.chatModel.model} / ${data.aiRuntime.chatModel.available ? "available" : "unavailable"}` : "unknown"} />
            <KeyValue label="EmbeddingModel" value={data.aiRuntime ? `${data.aiRuntime.embeddingModel.model} / ${data.aiRuntime.embeddingModel.dimensions}d` : "unknown"} />
            <KeyValue label="RAG ready" value={data.aiRuntime?.rag.ready ? "yes" : "no"} />
          </SettingsRow>

          <SettingsRow title="OpenAI 사용량" status={openAiUsage?.status === "AVAILABLE" ? "connected" : openAiUsage?.status === "NOT_CONFIGURED" ? "not_configured" : openAiUsage?.status === "UNAVAILABLE" ? "warning" : "unknown"} open={open === "OpenAI Usage"} onToggle={() => setOpen(open === "OpenAI Usage" ? "" : "OpenAI Usage")}>
            {data.auth.role !== "ADMIN" ? <p>OpenAI 비용과 사용량은 관리자 계정에서만 조회할 수 있습니다.</p> : null}
            {data.auth.role === "ADMIN" ? <>
              <div className="box-row"><strong>이번 달 조직 사용량</strong><button className="button button-secondary" type="button" onClick={() => void loadOpenAiUsage()} disabled={openAiUsageBusy}>{openAiUsageBusy ? "조회 중..." : "사용량 새로고침"}</button></div>
              {openAiUsageError ? <div className="empty-state error-state">{openAiUsageError}</div> : null}
              {openAiUsage ? <>
                <KeyValue label="조회 상태" value={openAiUsage.status === "AVAILABLE" ? "정상" : openAiUsage.status === "NOT_CONFIGURED" ? "관리자 키 설정 필요" : "일시 조회 불가"} />
                <KeyValue label="조회 기간" value={`${openAiUsage.periodStart} ~ ${formatPeriodEnd(openAiUsage.periodEnd)}`} />
                <KeyValue label="이번 달 비용" value={formatMoney(openAiUsage.currentCost)} />
                <KeyValue label="월 예산" value={openAiUsage.budgetConfigured ? formatMoney(openAiUsage.monthlyBudget) : "미설정"} />
                <KeyValue label="남은 예산" value={openAiUsage.budgetConfigured ? formatMoney(openAiUsage.remainingBudget) : "예산 설정 후 계산"} />
                <KeyValue label="예산 사용률" value={openAiUsage.usedPercent === null ? "예산 미설정" : `${openAiUsage.usedPercent.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%`} />
                <KeyValue label="모델 요청" value={`${openAiUsage.usage.requests.toLocaleString("ko-KR")}건`} />
                <KeyValue label="입력 토큰" value={openAiUsage.usage.inputTokens.toLocaleString("ko-KR")} />
                <KeyValue label="출력 토큰" value={openAiUsage.usage.outputTokens.toLocaleString("ko-KR")} />
                <KeyValue label="캐시 입력 토큰" value={openAiUsage.usage.cachedInputTokens.toLocaleString("ko-KR")} />
                <KeyValue label="마지막 조회" value={new Date(openAiUsage.updatedAt).toLocaleString("ko-KR")} />
                <p className="small-note">{openAiUsage.message} API 키와 조직·프로젝트 식별자는 화면에 노출하지 않습니다.</p>
              </> : openAiUsageBusy ? <p>OpenAI 조직 사용량을 조회하고 있습니다.</p> : null}
            </> : null}
          </SettingsRow>

          <SettingsRow title="Database" status={data.knowledge ? "connected" : "unknown"} open={open === "Database"} onToggle={() => setOpen(open === "Database" ? "" : "Database")}>
            <KeyValue label="Knowledge nodes" value={data.knowledge?.totalNodes ?? 0} />
            <KeyValue label="Knowledge edges" value={data.knowledge?.totalEdges ?? 0} />
          </SettingsRow>

          <SettingsRow title="Obsidian" status={data.historian?.enabled ? "connected" : "not_configured"} open={open === "Obsidian"} onToggle={() => setOpen(open === "Obsidian" ? "" : "Obsidian")}>
            <KeyValue label="Configured" value={data.historian?.configured ? "yes" : "no"} />
            <KeyValue label="Last export" value={data.historian?.lastExport ? formatTimeAgo(data.historian.lastExport.createdAt) : "None"} />
            <KeyValue label="Relative note path" value={data.historian?.lastExport?.notePath || "Not exposed"} />
          </SettingsRow>

          <SettingsRow title="Docker" status="unknown" open={open === "Docker"} onToggle={() => setOpen(open === "Docker" ? "" : "Docker")}>
            <p>Docker is validated by local CLI/compose checks, not browser UI execution. See README for compose startup.</p>
          </SettingsRow>

          <SettingsRow title="MCP" status={data.runtime ? data.runtime.status : "unknown"} open={open === "MCP"} onToggle={() => setOpen(open === "MCP" ? "" : "MCP")}>
            <KeyValue label="Queue path" value={data.runtime?.queue.path || "Unknown"} />
            <KeyValue label="Active task" value={data.runtime?.active_task || "None"} />
          </SettingsRow>

          <SettingsRow title="Slack" status={data.latestBatch?.slack_webhook_configured ? "configured" : "not_configured"} open={open === "Slack"} onToggle={() => setOpen(open === "Slack" ? "" : "Slack")}>
            <KeyValue label="Notification configured" value={data.latestBatch?.slack_webhook_configured ? "yes" : "no"} />
            <KeyValue label="Last daily report" value={data.dailyReport ? formatTimeAgo(data.dailyReport.created_at) : "None"} />
          </SettingsRow>

          <SettingsRow title="Public Access" status={data.publicAccess?.frontendPublicUrlConfigured ? "connected" : "not_configured"} open={open === "Public Access"} onToggle={() => setOpen(open === "Public Access" ? "" : "Public Access")}>
            <KeyValue label="Frontend public URL" value={data.publicAccess?.frontendPublicUrl || "Not configured"} />
            <KeyValue label="Backend public URL" value={data.publicAccess?.backendPublicUrl || "Not configured"} />
          </SettingsRow>

          <SettingsRow title="Security" status={data.security?.securityLevel || "unknown"} open={open === "Security"} onToggle={() => setOpen(open === "Security" ? "" : "Security")}>
            <KeyValue label="Authentication" value={data.security?.authentication.status || "unknown"} />
            <KeyValue label="OAuth provider" value={data.security?.oauth.provider || "Not configured"} />
            <KeyValue label="Approved devices" value={data.security?.deviceApproval.approvedDevicesCount ?? 0} />
          </SettingsRow>

          <SettingsRow title="Build Information" status={data.runtimeVersion ? "connected" : "unknown"} open={open === "Build Information"} onToggle={() => setOpen(open === "Build Information" ? "" : "Build Information")}>
            <KeyValue label="Backend branch" value={data.runtimeVersion?.branch || "Unknown"} />
            <KeyValue label="Backend commit" value={data.runtimeVersion?.commitSha || "Unknown"} />
            <KeyValue label="Started" value={data.runtimeVersion?.startedAt ? formatTimeAgo(data.runtimeVersion.startedAt) : "Unknown"} />
          </SettingsRow>
        </div>
      </SectionCard>
    </div>
  );
}

function SettingsRow({
  title,
  status,
  open,
  onToggle,
  children,
}: {
  title: string;
  status: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <details className="settings-row" open={open} onToggle={(event) => event.preventDefault()}>
      <summary onClick={onToggle}>
        <strong>{title}</strong>
        <StatusBadge status={status}>{status}</StatusBadge>
      </summary>
      <div className="settings-row-body">{children}</div>
    </details>
  );
}

function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="key-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatMoney(money: OpenAiUsageSummary["currentCost"]) {
  if (!money) return "조회되지 않음";
  return new Intl.NumberFormat("ko-KR", { style: "currency", currency: money.currency.toUpperCase(), minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(money.value);
}

function formatPeriodEnd(periodEnd: string) {
  const date = new Date(`${periodEnd}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

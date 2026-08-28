import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { CoreRoute } from "../app/navigation";
import { Pagination } from "../components/shared/Pagination";
import { StatusBadge } from "../components/shared/StatusBadge";
import {
  deleteMailFolder,
  deleteMailMessages,
  emptyMailTrash,
  getMailMessage,
  getMailMessages,
  getMailStatus,
  markMailMessagesRead,
  markMailMessagesStarred,
  markMailRead,
  permanentlyDeleteMailMessages,
  restoreMailMessages,
  sendMail,
  type MailFolder,
  type MailMessage,
  type MailMessagePage,
  type MailSearchField,
  type MailStatus,
  type PlatformRole,
} from "../lib/backendApi";
import { PageHeader } from "./ConsoleServicesPage";

type ComposerMode = "new" | "reply" | "replyAll" | "forward";
type ComposerDraft = {
  mode: ComposerMode;
  to: string;
  cc: string;
  subject: string;
  text: string;
};
type SelectionAction = "read" | "unread" | "star" | "unstar" | "trash" | "restore" | "permanent";

const folders: Array<{ id: MailFolder; label: string; symbol: string }> = [
  { id: "inbox", label: "받은메일함", symbol: "✉" },
  { id: "sent", label: "보낸메일함", symbol: "➤" },
  { id: "unread", label: "읽지 않은 메일", symbol: "●" },
  { id: "starred", label: "중요 메일", symbol: "★" },
  { id: "attachments", label: "첨부 메일", symbol: "⌕" },
  { id: "trash", label: "휴지통", symbol: "♲" },
];

const emptyPage = (page: number, size: number): MailMessagePage => ({
  items: [],
  page,
  size,
  total: 0,
  unread: 0,
});

export function MailPage({ role, onNavigate }: { role: PlatformRole; onNavigate: (route: CoreRoute) => void }) {
  const [folder, setFolder] = useState<MailFolder>("inbox");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [messages, setMessages] = useState<MailMessagePage>(() => emptyPage(0, 20));
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"list" | "detail">("list");
  const [composer, setComposer] = useState<ComposerDraft | null>(null);
  const [searchField, setSearchField] = useState<MailSearchField>("all");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    if (role !== "ADMIN") return;
    setLoading(true);
    setError("");
    try {
      const [nextStatus, nextMessages] = await Promise.all([
        getMailStatus(),
        getMailMessages(folder, page, pageSize, query, searchField),
      ]);
      setStatus({ ...nextStatus, unread: nextMessages.unread });
      setMessages(nextMessages);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "메일함을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [folder, page, pageSize, query, role, searchField]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const contacts = useMemo(() => {
    const mailbox = (status?.mailbox || "").toLowerCase();
    const addresses = messages.items.flatMap((message) =>
      message.direction === "inbound" ? [message.from_address] : message.to_addresses,
    );
    return [...new Set(addresses.filter((address) => address && address.toLowerCase() !== mailbox))].slice(0, 6);
  }, [messages.items, status?.mailbox]);

  const totalStored = Number(status?.counts?.inbox ?? 0)
    + Number(status?.counts?.sent ?? 0)
    + Number(status?.counts?.trash ?? 0);

  const clearSelection = () => setSelectedIds(new Set());

  const changeFolder = (nextFolder: MailFolder) => {
    setFolder(nextFolder);
    setPage(0);
    setSelected(null);
    setView("list");
    clearSelection();
    setNotice("");
  };

  const openMessage = async (message: MailMessage) => {
    setError("");
    try {
      let detail = await getMailMessage(message.id);
      if (folder !== "trash" && detail.direction === "inbound" && !detail.is_read) {
        const read = await markMailRead(detail.id, true);
        detail = { ...detail, is_read: true };
        setStatus((current) => current ? {
          ...current,
          unread: read.unread,
          counts: { ...current.counts, unread: read.unread },
        } : current);
        setMessages((current) => ({
          ...current,
          unread: read.unread,
          items: current.items.map((item) => item.id === detail.id ? { ...item, is_read: true } : item),
        }));
      }
      setSelected(detail);
      setView("detail");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "메일을 열지 못했습니다.");
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const performAction = async (ids: string[], action: SelectionAction) => {
    if (!ids.length) return;
    if (action === "permanent" && !window.confirm(`선택한 메일 ${ids.length}건을 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      let message = "";
      if (action === "read" || action === "unread") {
        const result = await markMailMessagesRead(ids, action === "read");
        message = `메일 ${result.updated}건을 ${action === "read" ? "읽음" : "읽지 않음"}으로 표시했습니다.`;
      } else if (action === "star" || action === "unstar") {
        const result = await markMailMessagesStarred(ids, action === "star");
        message = `메일 ${result.updated}건의 중요 표시를 ${action === "star" ? "설정" : "해제"}했습니다.`;
      } else if (action === "trash") {
        const result = await deleteMailMessages(ids);
        message = `메일 ${result.deleted}건을 휴지통으로 이동했습니다.`;
      } else if (action === "restore") {
        const result = await restoreMailMessages(ids);
        message = `메일 ${result.restored}건을 복원했습니다.`;
      } else {
        const result = await permanentlyDeleteMailMessages(ids);
        message = `메일 ${result.deleted}건을 완전히 삭제했습니다.`;
      }

      const removesFromCurrent = ["trash", "restore", "permanent"].includes(action)
        || (folder === "unread" && action === "read")
        || (folder === "starred" && action === "unstar");
      if (removesFromCurrent && selected && ids.includes(selected.id)) {
        setSelected(null);
        setView("list");
      } else if (selected && ids.includes(selected.id) && (action === "star" || action === "unstar")) {
        setSelected({ ...selected, is_starred: action === "star" });
      }
      clearSelection();
      setNotice(message);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "메일 작업을 완료하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const emptyCurrentFolder = async () => {
    const label = folder === "trash" ? "휴지통" : folder === "inbox" ? "받은메일함" : "보낸메일함";
    const permanent = folder === "trash";
    if (!window.confirm(`${label}의 메일을 ${permanent ? "완전히 삭제" : "휴지통으로 이동"}하시겠습니까?`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = permanent ? await emptyMailTrash() : await deleteMailFolder(folder as "inbox" | "sent");
      setSelected(null);
      setView("list");
      clearSelection();
      setPage(0);
      setNotice(`${label} ${result.deleted}건을 ${permanent ? "완전히 삭제" : "휴지통으로 이동"}했습니다.`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "편지함 정리에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const startCompose = (mode: ComposerMode, message?: MailMessage, contact?: string) => {
    if (mode === "new") {
      setComposer({ mode, to: contact || "", cc: "", subject: "", text: "" });
      return;
    }
    if (!message) return;
    const mailbox = (status?.mailbox || "").toLowerCase();
    const replyAddress = message.reply_to_addresses[0] || message.from_address;
    const allRecipients = [...new Set([
      replyAddress,
      ...message.to_addresses,
    ].filter((address) => address && address.toLowerCase() !== mailbox))];
    const replyCc = [...new Set(message.cc_addresses.filter((address) => address.toLowerCase() !== mailbox))];
    if (mode === "forward") {
      setComposer({
        mode,
        to: "",
        cc: "",
        subject: withPrefix(message.subject, "Fwd:"),
        text: `\n\n---------- 전달된 메일 ----------\n보낸 사람: ${message.from_address}\n일시: ${formatDate(message.occurred_at)}\n제목: ${message.subject || "(제목 없음)"}\n\n${message.text_body || stripHtml(message.html_body || "")}`,
      });
      return;
    }
    setComposer({
      mode,
      to: (mode === "replyAll" ? allRecipients : [replyAddress]).join(", "),
      cc: mode === "replyAll" ? replyCc.join(", ") : "",
      subject: withPrefix(message.subject, "Re:"),
      text: "",
    });
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(0);
    clearSelection();
    setQuery(searchInput.trim());
    setView("list");
  };

  if (role !== "ADMIN") {
    return <div className="console-page mail-page">
      <PageHeader title="메일" description="ArchiveOS 도메인 메일은 관리자 세션에서만 접근할 수 있습니다." />
      <section className="mail-access-card">
        <StatusBadge status="blocked">관리자 전용</StatusBadge>
        <h2>관리자 로그인이 필요합니다.</h2>
        <p>메일 본문과 외부 발송 기능은 공개·운영자·PM 세션에 노출되지 않습니다.</p>
        <button className="primary-action" type="button" onClick={() => onNavigate("settings")}>로그인 화면으로 이동</button>
      </section>
    </div>;
  }

  const allCurrentSelected = Boolean(messages.items.length)
    && messages.items.every((message) => selectedIds.has(message.id));
  const canEmptyFolder = ["inbox", "sent", "trash"].includes(folder);

  return <div className="console-page mail-page">
    <PageHeader title="메일" description="ArchiveOS 업무 메일을 검색하고 분류하며 외부 주소와 송수신합니다." />
    <div className="mail-status-strip">
      <StatusBadge status={status?.inbound_ready ? "healthy" : "waiting"}>수신 {status?.inbound_ready ? "연결" : "준비 중"}</StatusBadge>
      <StatusBadge status={status?.outbound_ready ? "healthy" : "waiting"}>발신 {status?.outbound_ready ? "연결" : "준비 중"}</StatusBadge>
      <StatusBadge status={status?.slack_ready ? "healthy" : "waiting"}>Slack {status?.slack_ready ? "알림 연결" : "미설정"}</StatusBadge>
      <span className="mail-status-separator" aria-hidden="true" />
      <span className="mail-address">{status?.mailbox || "csj@archiveos.kr"}</span>
      <span>읽지 않음 {status?.unread ?? 0}건</span>
      <button type="button" onClick={() => void refresh()} disabled={loading || busy}>{loading ? "갱신 중" : "새로고침"}</button>
    </div>
    {error ? <div className="mail-banner error" role="alert">{error}</div> : null}
    {notice ? <div className="mail-banner success" role="status">{notice}</div> : null}

    <div className="mail-layout">
      <aside className="mail-sidebar" aria-label="메일 탐색">
        <section className="mail-account-card">
          <span className="mail-avatar" aria-hidden="true">A</span>
          <div><strong>ArchiveOS</strong><small>{status?.mailbox || "csj@archiveos.kr"}</small></div>
          <p>보관된 메시지 <b>{totalStored.toLocaleString()}건</b></p>
        </section>
        <div className="mail-compose-actions">
          <button type="button" className="primary-action" onClick={() => startCompose("new")}>＋ 메일쓰기</button>
          <button type="button" onClick={() => startCompose("new", undefined, status?.mailbox)}>내게쓰기</button>
        </div>
        <nav className="mail-folders" aria-label="편지함">
          {folders.map((item) => <button key={item.id} type="button" className={folder === item.id ? "active" : ""} onClick={() => changeFolder(item.id)}>
            <span><i aria-hidden="true">{item.symbol}</i>{item.label}</span>
            <b>{Number(status?.counts?.[item.id] ?? (item.id === "unread" ? status?.unread : 0)).toLocaleString()}</b>
          </button>)}
        </nav>
        <section className="mail-contacts">
          <header><strong>최근 주소</strong><small>현재 목록 기준</small></header>
          {contacts.length ? <ul>{contacts.map((address) => <li key={address}><button type="button" title={address} onClick={() => startCompose("new", undefined, address)}><span aria-hidden="true">{address.slice(0, 1).toUpperCase()}</span><em>{address}</em><i aria-hidden="true">✉</i></button></li>)}</ul> : <p>표시할 주소가 없습니다.</p>}
        </section>
      </aside>

      <main className="mail-main-panel">
        <form className="mail-search-bar" onSubmit={submitSearch}>
          <select value={searchField} onChange={(event) => setSearchField(event.target.value as MailSearchField)} aria-label="메일 검색 범위">
            <option value="all">전체</option><option value="subject">메일 제목</option><option value="sender">보낸 사람</option><option value="recipient">받는 사람</option>
          </select>
          <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} maxLength={200} placeholder="메일 검색" aria-label="메일 검색어" />
          <button type="submit">검색</button>
          {query ? <button type="button" className="mail-search-clear" onClick={() => { setSearchInput(""); setQuery(""); setPage(0); }}>초기화</button> : null}
        </form>

        <div className="mail-workspace-tabs" role="tablist" aria-label="메일 작업 탭">
          <button type="button" role="tab" aria-selected={view === "list"} className={view === "list" ? "active" : ""} onClick={() => setView("list")}>{folderLabel(folder)} <b>{messages.total.toLocaleString()}</b></button>
          {selected ? <button type="button" role="tab" aria-selected={view === "detail"} className={view === "detail" ? "active" : ""} onClick={() => setView("detail")}><span>{selected.subject || "(제목 없음)"}</span><i aria-hidden="true">×</i></button> : null}
        </div>

        {view === "list" ? <>
          <div className="mail-list-toolbar">
            <label className="mail-select-all"><input type="checkbox" checked={allCurrentSelected} onChange={(event) => setSelectedIds(event.target.checked ? new Set(messages.items.map((message) => message.id)) : new Set())} /><span>전체 선택</span></label>
            {folder === "trash" ? <>
              <button type="button" disabled={!selectedIds.size || busy} onClick={() => void performAction([...selectedIds], "restore")}>복원</button>
              <button type="button" className="danger" disabled={!selectedIds.size || busy} onClick={() => void performAction([...selectedIds], "permanent")}>완전 삭제</button>
            </> : <>
              <button type="button" disabled={!selectedIds.size || busy} onClick={() => void performAction([...selectedIds], "read")}>읽음</button>
              <button type="button" disabled={!selectedIds.size || busy} onClick={() => void performAction([...selectedIds], "unread")}>안읽음</button>
              <button type="button" disabled={!selectedIds.size || busy} onClick={() => void performAction([...selectedIds], "star")}>중요</button>
              <button type="button" disabled={!selectedIds.size || busy} onClick={() => void performAction([...selectedIds], "unstar")}>중요 해제</button>
              <button type="button" disabled={!selectedIds.size || busy} onClick={() => void performAction([...selectedIds], "trash")}>삭제</button>
            </>}
            {canEmptyFolder ? <button type="button" className="danger mail-empty-folder" disabled={!messages.total || busy} onClick={() => void emptyCurrentFolder()}>{folder === "trash" ? "휴지통 비우기" : "편지함 정리"}</button> : null}
            <label className="mail-page-size">페이지당 <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); clearSelection(); }}>{[10, 20, 50].map((size) => <option key={size} value={size}>{size}개</option>)}</select></label>
          </div>

          <section className="mail-list-table" aria-label={folderLabel(folder)}>
            <div className="mail-list-head" aria-hidden="true"><span /><span>중요</span><span>{folder === "sent" ? "받는 사람" : "보낸 사람"}</span><span>제목</span><span>받은 날짜</span><span>크기</span></div>
            {loading && !messages.items.length ? <div className="mail-loading" role="status"><span className="loading-spinner" aria-hidden="true" />메일을 불러오는 중입니다.</div> : null}
            {!loading && !messages.items.length ? <p className="empty-copy">{query ? "검색 조건에 맞는 메일이 없습니다." : "표시할 메일이 없습니다."}</p> : null}
            {messages.items.map((message) => <div key={message.id} className={`mail-row-shell ${selected?.id === message.id ? "selected" : ""} ${message.is_read ? "" : "unread"}`}>
              <label className="mail-row-check"><input type="checkbox" checked={selectedIds.has(message.id)} onChange={() => toggleSelection(message.id)} aria-label={`메일 선택: ${message.subject || "제목 없음"}`} /></label>
              <button type="button" className={`mail-star ${message.is_starred ? "active" : ""}`} aria-label={message.is_starred ? "중요 표시 해제" : "중요 표시"} onClick={() => void performAction([message.id], message.is_starred ? "unstar" : "star")}>{message.is_starred ? "★" : "☆"}</button>
              <button type="button" className="mail-row" onClick={() => void openMessage(message)}>
                <span className="mail-row-party">{message.direction === "outbound" ? message.to_addresses.join(", ") : message.from_address}</span>
                <span className="mail-row-subject"><strong>{message.subject || "(제목 없음)"}</strong><small>{message.body_preview || "본문 미리보기 없음"}</small>{message.attachments.length ? <i>첨부 {message.attachments.length}</i> : null}{message.direction === "outbound" ? <StatusBadge status={mailDeliveryTone(message.delivery_status)}>{mailDeliveryLabel(message.delivery_status)}</StatusBadge> : null}</span>
                <time dateTime={message.occurred_at}>{formatListDate(message.occurred_at)}</time>
                <span className="mail-row-size">{formatBytes(message.size_bytes || 0)}</span>
              </button>
            </div>)}
          </section>
          <Pagination page={page} pageSize={pageSize} totalItems={messages.total} onPageChange={(next) => { clearSelection(); setPage(next); }} label="메일 목록 페이지" />
        </> : <MailDetail
          message={selected}
          onReply={(message) => startCompose("reply", message)}
          onReplyAll={(message) => startCompose("replyAll", message)}
          onForward={(message) => startCompose("forward", message)}
          onStar={(message) => void performAction([message.id], message.is_starred ? "unstar" : "star")}
          onTrash={(message) => void performAction([message.id], "trash")}
          onRestore={(message) => void performAction([message.id], "restore")}
          onPermanent={(message) => void performAction([message.id], "permanent")}
        />}
      </main>
    </div>

    {composer ? <ComposeDialog draft={composer} onClose={() => setComposer(null)} onError={setError} onSent={(message) => {
      setComposer(null);
      setNotice(`“${message.subject}” 메일을 발송했습니다.`);
      if (folder === "sent" && page === 0 && !query) {
        setMessages((current) => ({ ...current, items: [message, ...current.items].slice(0, current.size), total: current.total + 1 }));
      }
      setStatus((current) => current ? { ...current, counts: { ...current.counts, sent: Number(current.counts?.sent ?? 0) + 1 } } : current);
      setSearchInput("");
      setQuery("");
      setFolder("sent");
      setPage(0);
      setSelected(message);
      setView("detail");
      clearSelection();
    }} /> : null}
  </div>;
}

function MailDetail({ message, onReply, onReplyAll, onForward, onStar, onTrash, onRestore, onPermanent }: {
  message: MailMessage | null;
  onReply: (message: MailMessage) => void;
  onReplyAll: (message: MailMessage) => void;
  onForward: (message: MailMessage) => void;
  onStar: (message: MailMessage) => void;
  onTrash: (message: MailMessage) => void;
  onRestore: (message: MailMessage) => void;
  onPermanent: (message: MailMessage) => void;
}) {
  if (!message) return <section className="mail-detail empty-copy">목록에서 메일을 선택하세요.</section>;
  const trashed = Boolean(message.deleted_at);
  return <article className="mail-detail">
    <div className="mail-detail-toolbar">
      {!trashed && message.direction === "inbound" ? <><button type="button" onClick={() => onReply(message)}>답장</button><button type="button" onClick={() => onReplyAll(message)}>전체 답장</button></> : null}
      {!trashed ? <><button type="button" onClick={() => onForward(message)}>전달</button><button type="button" onClick={() => onStar(message)}>{message.is_starred ? "중요 해제" : "중요 표시"}</button><button type="button" onClick={() => onTrash(message)}>삭제</button></> : <><button type="button" onClick={() => onRestore(message)}>복원</button><button type="button" className="danger" onClick={() => onPermanent(message)}>완전 삭제</button></>}
    </div>
    <header>
      <StatusBadge status={message.direction === "inbound" ? "working" : mailDeliveryTone(message.delivery_status)}>{message.direction === "inbound" ? "수신" : mailDeliveryLabel(message.delivery_status)}</StatusBadge>
      <h2>{message.subject || "(제목 없음)"}</h2>
      <dl>
        <dt>보낸 사람</dt><dd>{message.from_address}</dd>
        <dt>받는 사람</dt><dd>{message.to_addresses.join(", ")}</dd>
        {message.cc_addresses.length ? <><dt>참조</dt><dd>{message.cc_addresses.join(", ")}</dd></> : null}
        <dt>일시</dt><dd>{formatDate(message.occurred_at)}</dd>
      </dl>
    </header>
    <pre className="mail-body">{message.text_body || stripHtml(message.html_body || "") || "본문이 없습니다."}</pre>
    {message.attachments.length ? <section className="mail-attachments"><h3>첨부파일</h3><ul>{message.attachments.map((attachment, index) => <li key={attachment.id || `${attachment.filename}-${index}`}><span aria-hidden="true">▣</span>{attachment.filename || "첨부파일"} <small>{attachment.size ? formatBytes(attachment.size) : ""}</small></li>)}</ul></section> : null}
  </article>;
}

function ComposeDialog({ draft, onClose, onSent, onError }: {
  draft: ComposerDraft;
  onClose: () => void;
  onSent: (message: MailMessage) => void;
  onError: (message: string) => void;
}) {
  const [to, setTo] = useState(draft.to);
  const [cc, setCc] = useState(draft.cc);
  const [subject, setSubject] = useState(draft.subject);
  const [text, setText] = useState(draft.text);
  const [sending, setSending] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSending(true);
    onError("");
    try {
      const message = await sendMail({ to: splitEmails(to), cc: splitEmails(cc), subject, text });
      onSent(message);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "메일 발송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  };
  return <div className="mail-compose-overlay" role="presentation">
    <section className="mail-compose-dialog" role="dialog" aria-modal="true" aria-labelledby="mail-compose-title">
      <header><div><span className="eyebrow">ARCHIVEOS MAIL</span><h2 id="mail-compose-title">{composerTitle(draft.mode)}</h2></div><button type="button" aria-label="메일 작성 닫기" onClick={onClose}>×</button></header>
      <form onSubmit={(event) => void submit(event)}>
        <label><span>받는 사람</span><input type="email" multiple required value={to} onChange={(event) => setTo(event.target.value)} placeholder="name@example.com" /></label>
        <label><span>참조</span><input type="email" multiple value={cc} onChange={(event) => setCc(event.target.value)} placeholder="쉼표로 여러 주소 입력" /></label>
        <label><span>제목</span><input required maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
        <label className="mail-compose-body"><span>본문</span><textarea required rows={14} maxLength={500000} value={text} onChange={(event) => setText(event.target.value)} /></label>
        <footer><button type="button" onClick={onClose}>취소</button><button className="primary-action" type="submit" disabled={sending}>{sending ? "발송 중" : "메일 발송"}</button></footer>
      </form>
    </section>
  </div>;
}

function folderLabel(folder: MailFolder) {
  return folders.find((item) => item.id === folder)?.label || "전체 메일";
}
function composerTitle(mode: ComposerMode) {
  return ({ new: "새 메일", reply: "답장", replyAll: "전체 답장", forward: "메일 전달" } as const)[mode];
}
function splitEmails(value: string) {
  return value.split(/[;,]/).map((item) => item.trim()).filter(Boolean);
}
function withPrefix(subject: string, prefix: string) {
  return subject.toLowerCase().startsWith(prefix.toLowerCase()) ? subject : `${prefix} ${subject || "(제목 없음)"}`;
}
function stripHtml(value: string) {
  return value.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
function formatDate(value: string) {
  return new Date(value).toLocaleString("ko-KR");
}
function formatListDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}
function formatBytes(value: number) {
  if (value < 1024) return `${value}B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`;
  return `${(value / 1024 / 1024).toFixed(1)}MB`;
}
function mailDeliveryLabel(value: string) {
  return ({ sent: "전달 중", delayed: "전달 지연", delivered: "수신 서버 전달 완료", bounced: "반송", failed: "발송 실패", suppressed: "발송 차단", complained: "스팸 신고" } as Record<string, string>)[value] ?? value;
}
function mailDeliveryTone(value: string) {
  return value === "delivered" ? "healthy" : ["bounced", "failed", "suppressed", "complained"].includes(value) ? "blocked" : value === "delayed" ? "warning" : "working";
}

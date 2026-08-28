import { FormEvent, useCallback, useEffect, useState } from "react";
import type { CoreRoute } from "../app/navigation";
import {
  getMailMessage,
  getMailMessages,
  getMailStatus,
  markMailRead,
  sendMail,
  type MailMessage,
  type MailMessagePage,
  type MailStatus,
  type PlatformRole,
} from "../lib/backendApi";
import { StatusBadge } from "../components/shared/StatusBadge";
import { PageHeader } from "./ConsoleServicesPage";

type Folder = "inbox" | "sent";

export function MailPage({ role, onNavigate }: { role: PlatformRole; onNavigate: (route: CoreRoute) => void }) {
  const [folder, setFolder] = useState<Folder>("inbox");
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [messages, setMessages] = useState<MailMessagePage | null>(null);
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    if (role !== "ADMIN") return;
    setLoading(true);
    setError("");
    try {
      const [nextStatus, nextMessages] = await Promise.all([getMailStatus(), getMailMessages(folder, page, 20)]);
      setStatus(nextStatus);
      setMessages(nextMessages);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "메일함을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [folder, page, role]);

  useEffect(() => { void refresh(); }, [refresh]);

  const openMessage = async (message: MailMessage) => {
    setError("");
    try {
      const detail = await getMailMessage(message.id);
      setSelected(detail);
      if (detail.direction === "inbound" && !detail.is_read) {
        const read = await markMailRead(detail.id, true);
        setStatus((current) => current ? { ...current, unread: read.unread } : current);
        setMessages((current) => current ? { ...current, unread: read.unread, items: current.items.map((item) => item.id === detail.id ? { ...item, is_read: true } : item) } : current);
        setSelected({ ...detail, is_read: true });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "메일을 열지 못했습니다.");
    }
  };

  if (role !== "ADMIN") {
    return <div className="console-page mail-page"><PageHeader title="메일" description="ArchiveOS 도메인 메일은 관리자 세션에서만 접근할 수 있습니다." />
      <section className="mail-access-card"><StatusBadge status="blocked">관리자 전용</StatusBadge><h2>관리자 로그인이 필요합니다.</h2><p>메일 본문과 외부 발송 기능은 공개·운영자·PM 세션에 노출되지 않습니다.</p><button className="primary-action" type="button" onClick={() => onNavigate("settings")}>로그인 화면으로 이동</button></section>
    </div>;
  }

  return <div className="console-page mail-page"><PageHeader title="메일" description="csj@archiveos.kr로 수신한 메일을 확인하고 외부 주소로 발송합니다." />
    <div className="mail-status-strip">
      <StatusBadge status={status?.inbound_ready ? "healthy" : "waiting"}>수신 {status?.inbound_ready ? "연결" : "준비 중"}</StatusBadge>
      <StatusBadge status={status?.outbound_ready ? "healthy" : "waiting"}>발신 {status?.outbound_ready ? "연결" : "준비 중"}</StatusBadge>
      <StatusBadge status={status?.slack_ready ? "healthy" : "waiting"}>Slack {status?.slack_ready ? "알림 연결" : "미설정"}</StatusBadge>
      <span className="mail-address">{status?.mailbox || "csj@archiveos.kr"}</span><span>읽지 않음 {status?.unread ?? 0}건</span>
      <button type="button" onClick={() => void refresh()} disabled={loading}>{loading ? "갱신 중" : "새로고침"}</button>
    </div>
    {error ? <div className="mail-banner error" role="alert">{error}</div> : null}
    {notice ? <div className="mail-banner success" role="status">{notice}</div> : null}
    <div className="mail-layout">
      <aside className="mail-folders"><button className={folder === "inbox" ? "active" : ""} onClick={() => { setFolder("inbox"); setPage(0); setSelected(null); }}>받은메일 <b>{status?.unread ?? 0}</b></button><button className={folder === "sent" ? "active" : ""} onClick={() => { setFolder("sent"); setPage(0); setSelected(null); }}>보낸메일</button></aside>
      <section className="mail-list" aria-label={folder === "inbox" ? "받은메일" : "보낸메일"}>
        <ComposeMail onSent={(message) => { setNotice(`“${message.subject}” 메일을 발송했습니다.`); setFolder("sent"); setPage(0); setSelected(message); void refresh(); }} onError={setError} />
        {!messages?.items.length && !loading ? <p className="empty-copy">표시할 메일이 없습니다.</p> : null}
        {messages?.items.map((message) => <button key={message.id} type="button" className={`mail-row ${selected?.id === message.id ? "selected" : ""} ${message.is_read ? "" : "unread"}`} onClick={() => void openMessage(message)}><span className="mail-row-party">{folder === "inbox" ? message.from_address : message.to_addresses.join(", ")}</span><strong>{message.subject || "(제목 없음)"}</strong><time>{new Date(message.occurred_at).toLocaleString()}</time>{message.direction === "outbound" ? <StatusBadge status={mailDeliveryTone(message.delivery_status)}>{mailDeliveryLabel(message.delivery_status)}</StatusBadge> : null}{message.attachments.length ? <span>첨부 {message.attachments.length}</span> : null}</button>)}
        <div className="mail-pagination"><button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>이전</button><span>{messages ? `${page + 1} / ${Math.max(1, Math.ceil(messages.total / messages.size))}` : "1 / 1"}</span><button type="button" disabled={!messages || (page + 1) * messages.size >= messages.total} onClick={() => setPage((value) => value + 1)}>다음</button></div>
      </section>
      <MailDetail message={selected} onReply={(address, subject) => window.dispatchEvent(new CustomEvent("archiveos-mail-reply", { detail: { address, subject } }))} />
    </div>
  </div>;
}

function ComposeMail({ onSent, onError }: { onSent: (message: MailMessage) => void; onError: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  useEffect(() => {
    const reply = (event: Event) => { const detail = (event as CustomEvent<{ address: string; subject: string }>).detail; setOpen(true); setTo(detail.address); setSubject(detail.subject.startsWith("Re:") ? detail.subject : `Re: ${detail.subject}`); };
    window.addEventListener("archiveos-mail-reply", reply); return () => window.removeEventListener("archiveos-mail-reply", reply);
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSending(true); onError("");
    try {
      const message = await sendMail({ to: splitEmails(to), cc: splitEmails(cc), subject, text });
      setTo(""); setCc(""); setSubject(""); setText(""); setOpen(false); onSent(message);
    } catch (reason) { onError(reason instanceof Error ? reason.message : "메일 발송에 실패했습니다."); }
    finally { setSending(false); }
  };
  return <div className="mail-compose"><button type="button" className="primary-action" onClick={() => setOpen((value) => !value)}>{open ? "작성 닫기" : "새 메일"}</button>{open ? <form onSubmit={(event) => void submit(event)}><label>받는 사람<input type="email" multiple required value={to} onChange={(event) => setTo(event.target.value)} placeholder="name@example.com" /></label><label>참조<input type="email" multiple value={cc} onChange={(event) => setCc(event.target.value)} placeholder="선택 입력" /></label><label>제목<input required maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} /></label><label>본문<textarea required rows={8} maxLength={500000} value={text} onChange={(event) => setText(event.target.value)} /></label><button className="primary-action" type="submit" disabled={sending}>{sending ? "발송 중" : "외부 메일 발송"}</button></form> : null}</div>;
}

function MailDetail({ message, onReply }: { message: MailMessage | null; onReply: (address: string, subject: string) => void }) {
  if (!message) return <section className="mail-detail empty-copy">목록에서 메일을 선택하세요.</section>;
  return <article className="mail-detail"><header><StatusBadge status={message.direction === "inbound" ? "working" : mailDeliveryTone(message.delivery_status)}>{message.direction === "inbound" ? "수신" : mailDeliveryLabel(message.delivery_status)}</StatusBadge><h2>{message.subject || "(제목 없음)"}</h2><dl><dt>보낸 사람</dt><dd>{message.from_address}</dd><dt>받는 사람</dt><dd>{message.to_addresses.join(", ")}</dd>{message.cc_addresses.length ? <><dt>참조</dt><dd>{message.cc_addresses.join(", ")}</dd></> : null}<dt>일시</dt><dd>{new Date(message.occurred_at).toLocaleString()}</dd></dl>{message.direction === "inbound" ? <button type="button" onClick={() => onReply(message.reply_to_addresses[0] || message.from_address, message.subject)}>답장</button> : null}</header><pre className="mail-body">{message.text_body || message.html_body || "본문이 없습니다."}</pre>{message.attachments.length ? <section><h3>첨부파일</h3><ul>{message.attachments.map((attachment, index) => <li key={attachment.id || `${attachment.filename}-${index}`}>{attachment.filename || "첨부파일"} {attachment.size ? `· ${attachment.size.toLocaleString()} bytes` : ""}</li>)}</ul></section> : null}</article>;
}

function splitEmails(value: string) { return value.split(/[;,]/).map((item) => item.trim()).filter(Boolean); }
function mailDeliveryLabel(value: string) { return ({ sent: "전달 중", delayed: "전달 지연", delivered: "수신 서버 전달 완료", bounced: "반송", failed: "발송 실패", suppressed: "발송 차단", complained: "스팸 신고" } as Record<string, string>)[value] ?? value; }
function mailDeliveryTone(value: string) { return ["delivered"].includes(value) ? "healthy" : ["bounced", "failed", "suppressed", "complained"].includes(value) ? "blocked" : value === "delayed" ? "warning" : "working"; }

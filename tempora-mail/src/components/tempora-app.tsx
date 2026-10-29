"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Inbox = { id: string; address: string; token: string; expiresAt: string };
type Summary = { id: string; sender: string; subject: string; receivedAt: string };
type Message = Summary & { textBody: string; htmlBody: string };
const stamp = (v: string) => new Date(v).toLocaleString();
function remaining(v: string, now: number) {
  const ms = Math.max(0, new Date(v).getTime() - now);
  return `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
}
export default function TemporaApp() {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [messages, setMessages] = useState<Summary[]>([]);
  const [selected, setSelected] = useState<Message | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dark, setDark] = useState(false);
  const poll = useRef(false);
  const notify = useCallback((v: string) => { setNotice(v); window.setTimeout(() => setNotice(""), 2800); }, []);
  const createInbox = useCallback(async (announce = true) => {
    setBusy(true); setError(""); setSelected(null); setMessages([]);
    try {
      const r = await fetch("/api/inboxes", { method: "POST", cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not create inbox.");
      setInbox(data);
      if (announce) notify("New temporary inbox created.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create inbox."); }
    finally { setBusy(false); }
  }, [notify]);
  const loadMessages = useCallback(async (active: Inbox, quiet = false) => {
    if (poll.current) return;
    poll.current = true; if (!quiet) setLoading(true);
    try {
      const r = await fetch(`/api/inboxes/${active.id}/messages`, { headers: { "x-inbox-token": active.token }, cache: "no-store" });
      const data = await r.json();
      if (!r.ok) {
        if (r.status === 410) { setInbox(null); setMessages([]); setSelected(null); setError("This inbox expired. Generate a new address."); }
        else if (!quiet) setError(data.error || "Could not refresh inbox.");
        return;
      }
      setMessages(data.messages);
      setSelected((cur) => cur && data.messages.some((m: Summary) => m.id === cur.id) ? cur : null);
      setError("");
    } catch { if (!quiet) setError("Network error while loading inbox."); }
    finally { poll.current = false; setLoading(false); }
  }, []);
  useEffect(() => { void createInbox(false); }, [createInbox]);
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  useEffect(() => {
    if (!inbox) return;
    void loadMessages(inbox);
    const t = window.setInterval(() => void loadMessages(inbox, true), 5000);
    return () => window.clearInterval(t);
  }, [inbox, loadMessages]);
  async function copyAddress() {
    if (!inbox) return;
    try { await navigator.clipboard.writeText(inbox.address); notify("Email address copied."); }
    catch { setError("Clipboard unavailable. Select the address to copy it."); }
  }
  async function deleteInbox() {
    if (!inbox || !window.confirm("Delete this inbox and all messages? This cannot be undone.")) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/inboxes/${inbox.id}`, { method: "DELETE", headers: { "x-inbox-token": inbox.token }, cache: "no-store" });
      if (!r.ok) throw new Error("Deletion failed. Please retry.");
      setInbox(null); setMessages([]); setSelected(null); notify("Inbox deleted."); await createInbox(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Deletion failed."); }
    finally { setBusy(false); }
  }
  async function openMessage(item: Summary) {
    if (!inbox) return;
    try {
      const r = await fetch(`/api/inboxes/${inbox.id}/messages/${item.id}`, { headers: { "x-inbox-token": inbox.token }, cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not open message.");
      setSelected(data.message);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not open message."); }
  }
  return <main className={dark ? "app dark" : "app"}>
    <header className="topbar"><a className="brand" href="#"><span className="logo">✉</span><span><b>Tempora <em>Mail</em></b><small>Fast. Private. Temporary.</small></span></a><nav><a href="#how">How it works</a><a href="#privacy">Privacy</a></nav><button className="theme" onClick={() => setDark(v => !v)} aria-label="Toggle theme">{dark ? "☀️" : "🌙"}</button></header>
    <section className="hero"><div className="heroicon">✉<span>✦</span></div><div className="heroText"><div className="eyebrow"><span className="pulse" /> TEMPORARY EMAIL, SIMPLIFIED</div><h1>Your Temporary<br/><strong>Email Address</strong></h1><p>Get a disposable inbox in seconds. No registration needed.</p>
      <div className="addressbar"><span className="mailglyph">✉</span><code>{inbox?.address ?? (busy ? "Creating your address…" : "Inbox unavailable")}</code><button className="copy" onClick={copyAddress} disabled={!inbox}>Copy</button></div>
      <div className="actions"><button className="primary" onClick={() => void createInbox()} disabled={busy}>⟳ Generate New Email</button><button className="secondary" onClick={() => inbox && void loadMessages(inbox)} disabled={!inbox || loading}>↻ Refresh Inbox</button><button className="outline" onClick={deleteInbox} disabled={!inbox || busy}>⌫ Delete Inbox</button></div>
      <div className="expiry">◷ <span>Expires in</span><b>{inbox ? remaining(inbox.expiresAt, now) : "--:--"}</b></div>
      <div className="demoNotice"><span>ⓘ</span><div><b>Inbound email setup required</b><small>Real email arrives only after configuring your receiving domain, DNS, Resend API key and webhook. Follow the README setup guide.</small></div></div>
      {error && <div className="error" role="alert">{error}</div>}
    </div></section>
    <section className="inbox"><div className="inboxHead"><div><h2>Inbox <span className="count">{messages.length}</span></h2><p>New messages refresh automatically every 5 seconds.</p></div><div className="live"><span/> {loading ? "Refreshing…" : "Auto-refresh on"}</div></div>
      <div className="inboxGrid"><div className="mailList"><div className="listHead"><span>Sender / Subject</span><span>Received</span></div>{messages.length === 0 ? <div className="empty"><div className="emptyIcon">✉</div><b>Your inbox is empty</b><p>Waiting for incoming messages…</p><small>Send a test email after delivery is configured.</small></div> : messages.map(m => <button key={m.id} className={`mailrow ${selected?.id === m.id ? "chosen" : ""}`} onClick={() => void openMessage(m)}><span className="avatar">{(m.sender || "?")[0].toUpperCase()}</span><span className="mailMeta"><b>{m.sender}</b><strong>{m.subject}</strong></span><time>{stamp(m.receivedAt)}</time></button>)}</div>
        <div className="reader">{!selected ? <div className="readerEmpty"><div className="readerIcon">▤</div><b>Select an email to read</b><p>Choose a message from your inbox to view its contents.</p></div> : <article className="message"><h3>{selected.subject}</h3><p className="senderLine">From: {selected.sender}</p><p className="receivedLine">{stamp(selected.receivedAt)}</p><pre>{selected.textBody || "No plain-text body was provided."}</pre>{selected.htmlBody && <details><summary>HTML source (unrendered)</summary><pre>{selected.htmlBody}</pre></details>}</article>}</div>
      </div><div className="inboxFoot"><span>🔒 Treat your inbox token like a password.</span><span>{loading ? "Syncing…" : "Live polling: 5 seconds"}</span></div>
    </section>
    <section className="contentPage" id="how"><div className="eyebrow">TEMPORA MAIL / HOW IT WORKS</div><h2>Disposable email, made simple.</h2><div className="infoCards"><article className="infoCard"><span className="step">01</span><p>Generate a unique address and copy it into a signup form.</p></article><article className="infoCard"><span className="step">02</span><p>Once inbound delivery is configured, incoming email appears in your inbox.</p></article><article className="infoCard"><span className="step">03</span><p>Messages refresh automatically. Delete the inbox any time or let it expire.</p></article></div></section>
    <footer id="privacy"><div className="footerTop"><div className="footerBrand"><span className="logo">✉</span><div><b>Tempora <em>Mail</em></b><small>Fast. Private. Temporary.</small><p>Do not use temporary inboxes for sensitive accounts or confidential messages.</p></div></div><div><b>Privacy basics</b><p className="footerText">Messages are stored until deleted or expired. Attachments are not supported. Review your privacy policy and local legal obligations before public launch.</p></div><div className="privacy"><span>♧</span><div><b>Your Privacy Matters</b><p>Message bodies are shown as plain text; received HTML is never rendered as executable markup.</p></div></div></div><div className="footerBottom"><span>© {new Date().getFullYear()} Tempora Mail.</span><span>Fast. Private. Temporary.</span></div></footer>
    {notice && <div className="toast" role="status">✓ {notice}</div>}
  </main>;
}

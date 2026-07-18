import { useEffect, useRef, useState } from "react";
import api from "../api/client";
import { useChat } from "../context/ChatContext";

// Quick actions grouped by business area, matching the deterministic
// scenario-engine intents (BR-003/008/009/010) -- no LLM. "form" actions
// open a small structured input (product/qty) instead of a bare prefill,
// so the required fields are explicit instead of the user having to know
// the right phrasing. Note: none of the current scenario definitions take
// an explicit Plant filter param -- they scan every configured WMPS plant
// automatically -- so no Plant field is shown here (would silently do
// nothing if added; wire it into the scenario SQL first if needed).
const CHIP_GROUPS = [
  { title: "Production Planning", chips: [
    { label: "🏭 Can we manufacture a product?", form: "manufacture" },
    { label: "📋 Production Tree", prefill: "Draw the production tree for " },
    { label: "🧪 Material Requirements", form: "manufacture" },
  ]},
  { title: "Inventory", chips: [
    { label: "📦 Finished Product Stock", form: "stock" },
    { label: "🧱 Raw Material Stock", form: "stock" },
    { label: "🔎 Batch Status", prefill: "Batch status " },
  ]},
  { title: "Warehouse", chips: [
    { label: "📥 Goods Receipt", send: "Show goods receipts for the last 7 days" },
    { label: "🚚 Dispatch", send: "Which batches were dispatched this month?" },
    { label: "📊 Recent Production Batches", send: "Show the 10 most recent production batches" },
  ]},
];

const QUICK_ACTIONS = [
  { label: "🌳 Production tree — enter batch no.", prefill: "Draw the production tree for " },
  { label: "🧬 Material lots issued — enter batch no.", prefill: "What material lots were issued into batch " },
];

const QUICK = [
  "Which batches are pending QC approval?",
];

function Bubble({ who, children }) {
  return <div className={`bubble ${who}`}>{children}</div>;
}

// ---------------------------------------------------------------------------
// Lightweight markdown renderer for LLM answers (headings, bold, bullet
// lists, and pipe-tables), so formatted output renders as real UI elements
// instead of raw ### / ** / | characters. No external dependency; plain
// string parsing producing React elements (no dangerouslySetInnerHTML).
// ---------------------------------------------------------------------------
function inlineMd(text, keyBase) {
  const parts = [];
  let rest = text;
  let k = 0;
  while (rest.length) {
    const m = rest.match(/\*\*(.+?)\*\*/);
    if (!m) { parts.push(rest); break; }
    if (m.index > 0) parts.push(rest.slice(0, m.index));
    parts.push(<b key={`${keyBase}-b${k++}`}>{m[1]}</b>);
    rest = rest.slice(m.index + m[0].length);
  }
  return parts;
}

function MarkdownText({ text }) {
  const lines = String(text).split("\n");
  const blocks = [];
  let i = 0, key = 0;
  while (i < lines.length) {
    const line = lines[i];
    // pipe table: collect consecutive | lines, skip |---| separators
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const tbl = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        if (!/^\s*\|[\s\-:|]+\|\s*$/.test(lines[i])) {
          tbl.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
        }
        i++;
      }
      if (tbl.length) {
        // result-table-wrap (styles.css): sticky header + single horizontal
        // scrollbar, and the parent bubble widens for tables -- fixes the
        // "double scrollbar, can't see the data" problem on wide result
        // tables (many WMPS columns) sitting in a narrow, height-capped
        // chat bubble.
        blocks.push(
          <div key={`t${key++}`} className="result-table-wrap">
            <table className="mdtable">
              <thead>
                <tr>{tbl[0].map((c, j) => (
                  <th key={j}>{inlineMd(c, `h${j}`)}</th>
                ))}</tr>
              </thead>
              <tbody>
                {tbl.slice(1).map((row, r) => (
                  <tr key={r}>{row.map((c, j) => (
                    <td key={j}>{inlineMd(c, `c${r}-${j}`)}</td>
                  ))}</tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }
    // heading
    const h = line.match(/^\s*(#{1,4})\s+(.*)$/);
    if (h) {
      blocks.push(<div key={`h${key++}`} style={{ fontWeight: 700, fontSize: "1.05em", margin: "10px 0 4px" }}>
        {inlineMd(h[2], `hh${key}`)}</div>);
      i++;
      continue;
    }
    // bullet list: collect consecutive - / * lines
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={`u${key++}`} style={{ margin: "6px 0", paddingLeft: 22 }}>
          {items.map((it, j) => <li key={j} style={{ margin: "2px 0" }}>{inlineMd(it, `li${j}`)}</li>)}
        </ul>
      );
      continue;
    }
    // plain line (blank lines become spacing)
    if (line.trim() === "") {
      blocks.push(<div key={`s${key++}`} style={{ height: 6 }} />);
    } else {
      blocks.push(<div key={`p${key++}`}>{inlineMd(line, `p${key}`)}</div>);
    }
    i++;
  }
  return <div>{blocks}</div>;
}

function CapChips({ chips }) {
  return (
    <div className="capgrid">
      {chips.map((c, i) => (
        <div className="capchip" key={i}>
          <span className={`cs ${c.s}`}>{c.st}</span><br />
          <b>{c.t}</b><br />{c.d}<br />
          <span style={{ color: "var(--ink-soft)" }}>src: {c.src}</span>
        </div>
      ))}
    </div>
  );
}

export default function Copilot() {
  const { messages, setMessages, sessionId: SESSION_ID, pendingPrompt, setPendingPrompt } = useChat();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [formPanel, setFormPanel] = useState(null); // null | "manufacture" | "stock"
  const [formProduct, setFormProduct] = useState("");
  const [formQty, setFormQty] = useState("");
  const logRef = useRef(null);
  const inputRef = useRef(null);

  function submitForm() {
    const product = formProduct.trim();
    if (!product) return;
    const text = formPanel === "manufacture"
      ? `Material availability ${product}${formQty.trim() ? " " + formQty.trim() : ""}`
      : `Current stock of ${product}`;
    setFormPanel(null); setFormProduct(""); setFormQty("");
    send(text);
  }

  function pushBubble(m) {
    setMessages((prev) => [...prev, m]);
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 30);
  }

  // A question typed into CommandWorkspace's prompt box lands here as
  // pendingPrompt; consume it exactly once so it goes through the same
  // real send() pipeline as anything typed directly into this chat.
  useEffect(() => {
    if (pendingPrompt) {
      const text = pendingPrompt;
      setPendingPrompt(null);
      send(text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt]);

  async function send(text) {
    if (!text.trim()) return;
    pushBubble({ who: "user", text });
    setInput("");
    setBusy(true);
    try {
      const res = await api.post("/api/v1/copilot/chat", { message: text, session_id: SESSION_ID });
      renderResponse(res.data);
    } finally {
      setBusy(false);
    }
  }

  async function confirmYes(data) {
    setBusy(true);
    try {
      const res = await api.post("/api/v1/copilot/confirm", {
        request_id: data.request_id, correlation_id: data.correlation_id, intent_code: data.intent_code,
        session_id: SESSION_ID, entities: data.entities,
      });
      renderResponse(res.data);
    } finally {
      setBusy(false);
    }
  }

  async function approve(runId, action) {
    setBusy(true);
    try {
      const res = await api.post("/api/v1/copilot/approve", { run_id: runId, action });
      pushBubble({ who: "agent", text: res.data.message });
    } finally {
      setBusy(false);
    }
  }

  function renderResponse(data) {
    if (data.type === "unknown") {
      pushBubble({ who: "agent", text: data.message });
      return;
    }
    if (data.type === "confirm") {
      pushBubble({
        who: "agent",
        text: data.message,
        actions: [{ label: "✓ Yes, proceed", cls: "primary", fn: () => confirmYes(data) }],
      });
      return;
    }
    if (data.type === "clarify") {
      pushBubble({ who: "agent", text: `${data.routing ? data.routing + "\n\n" : ""}${data.message}` });
      return;
    }
    if (data.type === "llm_answer") {
      const agentNote = data.agent ? `**${data.agent}**` : "";
      const toolsNote = data.tools_called && data.tools_called.length
        ? ` (used: ${data.tools_called.join(", ")})`
        : "";
      const footer = agentNote || toolsNote ? `\n\n${agentNote}${toolsNote}` : "";
      pushBubble({ who: "agent", text: `${data.message}${footer}` });
      return;
    }
    // type === "result"
    const r = data.result;
    pushBubble({ who: "agent", text: data.routing, kv: true });
    if (r.capability_outputs) {
      pushBubble({
        who: "agent",
        text: `PPIC Agent — orchestrated check · ${data.request_id} · ${data.correlation_id} · ${data.intent_code}`,
        chips: r.capability_outputs,
        decision: r,
      });
      if (r.status === "pending_approval" && r.workflow?.approval_required) {
        pushBubble({
          who: "agent",
          text: `Workflow Mapping → ${r.workflow.name} · approval: ${r.workflow.approver_role}`,
          actions: [
            { label: "✓ Approve", cls: "human", fn: () => approve(r.run_id, "approve") },
            { label: "✎ Modify & approve", fn: () => approve(r.run_id, "modify") },
            { label: "✗ Reject", cls: "danger", fn: () => approve(r.run_id, "reject") },
            { label: "↗ Escalate", fn: () => approve(r.run_id, "escalate") },
          ],
        });
      }
    } else {
      pushBubble({
        who: "agent",
        text: `${r.decision}${r.detail ? " — " + r.detail : ""}`,
        decisionSimple: r,
      });
      if (r.chips) pushBubble({ who: "agent", text: "", chips: r.chips.map(chipify) });
    }
  }

  function chipify(c) {
    if (c.material !== undefined) {
      return { t: c.material, s: c.free > 0 ? "ok" : "err", st: c.free > 0 ? "IN STOCK" : "OUT",
        d: `stock ${c.stock} · reserved ${c.reserved} · free ${c.free}`, src: "WMS / SAP MM" };
    }
    if (c.line !== undefined) {
      return { t: c.line, s: c.status === "AVAILABLE" ? "ok" : "warn", st: c.status,
        d: `${c.product} · free from ${c.free_from} · rate ${c.rate ?? "—"} M/day`, src: "SAP PP / MES" };
    }
    return c;
  }

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Enterprise Copilot</h1>
          <p>One chat for every business question — the Intent Engine identifies the intent and the Orchestrator routes automatically. It asks back when inputs are missing, and computes decisions from live WMPS data (batch status, inventory, genealogy) and simulated SAP · WMS · LIMS data (procurement, replenishment, batch release) where a real integration isn't wired up yet, routing approvals per the Workflow Mapping.</p>
        </div>
        <span className="pill sys">ONE COPILOT · AGENTS AUTO-SELECTED</span>
      </div>
      <div className="card">
        <div className="chatlog" ref={logRef}>
          {messages.map((m, i) => (
            <Bubble who={m.who} key={i}>
              {m.text && (m.who === "agent"
                ? <MarkdownText text={m.text} />
                : <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>)}
              {m.chips && <CapChips chips={m.chips} />}
              {m.decision && (
                <div className={`decision-card ${m.decision.risk === "High" ? "err" : m.decision.risk === "Medium" ? "warn" : ""}`}>
                  <h4 style={{ fontWeight: 700 }}>{m.decision.decision}</h4>
                  {m.decision.reason}
                  <div className="kv">risk = {m.decision.risk} · confidence = {m.decision.confidence}</div>
                </div>
              )}
              {m.decisionSimple && (
                <div className="kv">risk = {m.decisionSimple.risk} · confidence = {m.decisionSimple.confidence}</div>
              )}
              {m.actions && (
                <div className="chatbtns">
                  {m.actions.map((a, j) => (
                    <button key={j} className={`btn ${a.cls || ""}`} disabled={busy} onClick={a.fn}>{a.label}</button>
                  ))}
                </div>
              )}
            </Bubble>
          ))}
          {busy && (
            <Bubble who="agent">
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink-soft, #667)" }}>
                <span className="working-dots" style={{ display: "inline-flex", gap: 4 }}>
                  <span style={{ animation: "wdot 1.2s infinite 0s" }}>●</span>
                  <span style={{ animation: "wdot 1.2s infinite 0.2s" }}>●</span>
                  <span style={{ animation: "wdot 1.2s infinite 0.4s" }}>●</span>
                </span>
                Working on it — identifying intent, querying live systems…
                <style>{`@keyframes wdot { 0%,60%,100% { opacity: 0.25 } 30% { opacity: 1 } }`}</style>
              </div>
            </Bubble>
          )}
        </div>
        {formPanel && (
          <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px",
                        margin: "10px 0", background: "var(--card)" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              {formPanel === "manufacture" ? "Material availability to manufacture" : "Finished product stock"}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: ".78rem" }}>
                Product
                <input value={formProduct} onChange={(e) => setFormProduct(e.target.value)}
                  placeholder="e.g. DOLUTEGRAVIR SODIUM" autoFocus
                  onKeyDown={(e) => e.key === "Enter" && submitForm()} />
              </label>
              {formPanel === "manufacture" && (
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: ".78rem" }}>
                  Planned Quantity (optional)
                  <input value={formQty} onChange={(e) => setFormQty(e.target.value)} placeholder="e.g. 500"
                    onKeyDown={(e) => e.key === "Enter" && submitForm()} style={{ width: 140 }} />
                </label>
              )}
              <button className="btn" disabled={busy || !formProduct.trim()} onClick={submitForm}>Check</button>
              <button disabled={busy} onClick={() => { setFormPanel(null); setFormProduct(""); setFormQty(""); }}>
                Cancel</button>
            </div>
          </div>
        )}
        {CHIP_GROUPS.map((g) => (
          <div key={g.title} style={{ marginTop: 10 }}>
            <div style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--ink-soft, #667)",
                          textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 }}>{g.title}</div>
            <div className="quickchips">
              {g.chips.map((c) => (
                <button key={c.label} disabled={busy} style={{ fontWeight: 600 }} onClick={() => {
                  if (c.form) { setFormPanel(c.form); setFormProduct(""); setFormQty(""); }
                  else if (c.send) send(c.send);
                  else { setInput(c.prefill); inputRef.current?.focus(); }
                }}>{c.label}</button>
              ))}
            </div>
          </div>
        ))}
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: ".72rem", fontWeight: 700, color: "var(--ink-soft, #667)",
                        textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 }}>More</div>
          <div className="quickchips">
            {QUICK_ACTIONS.map((a) => (
              <button key={a.label} disabled={busy} style={{ fontWeight: 600 }}
                onClick={() => { setInput(a.prefill); inputRef.current?.focus(); }}>{a.label}</button>
            ))}
            {QUICK.map((q) => (
              <button key={q} disabled={busy} onClick={() => send(q)}>{q}</button>
            ))}
          </div>
        </div>
        <div className="chatinput">
          <input
            ref={inputRef}
            type="text" value={input} placeholder="Ask a business question…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
          />
          <button className="btn primary" disabled={busy} onClick={() => send(input)}>Send ➤</button>
        </div>
      </div>
    </div>
  );
}

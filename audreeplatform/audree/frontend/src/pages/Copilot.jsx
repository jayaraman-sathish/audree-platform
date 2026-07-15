import { useRef, useState } from "react";
import api from "../api/client";

const QUICK = [
  "Can we commit 10 million Amoxicillin 500 mg capsules by 30 Sept?",
  "What about 20 million?",
  "What is the current stock of API Amoxicillin?",
  "Show the production plan for all lines",
  "Commit paracetamol 5 million by 15 Aug, Hyderabad",
  "Check materials for batch B-24-0201",
  "Can we run campaign PC-2207 on Line 3 in the next 14 days?",
  "Is batch B-24-0187 ready for release?",
  "Which customer commitments are at risk this month?",
];

const SESSION_ID = "session-" + Math.random().toString(36).slice(2);

function Bubble({ who, children }) {
  return <div className={`bubble ${who}`}>{children}</div>;
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
  const [messages, setMessages] = useState([
    { who: "agent", text: "Hello — I'm the Audree Enterprise Copilot. Ask your business question in plain language; I identify the intent and route it automatically. Try one of the quick questions below." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);

  function pushBubble(m) {
    setMessages((prev) => [...prev, m]);
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 30);
  }

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
      const toolsNote = data.tools_called && data.tools_called.length
        ? `\n\n(used: ${data.tools_called.join(", ")})`
        : "";
      pushBubble({ who: "agent", text: `${data.message}${toolsNote}` });
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
          <p>One chat for every business question — the Intent Engine identifies the intent and the Orchestrator routes automatically. It asks back when inputs are missing, computes decisions with risk &amp; confidence from simulated SAP · WMS · LIMS data, and routes approvals per the Workflow Mapping.</p>
        </div>
        <span className="pill sys">ONE COPILOT · AGENTS AUTO-SELECTED</span>
      </div>
      <div className="card">
        <div className="chatlog" ref={logRef}>
          {messages.map((m, i) => (
            <Bubble who={m.who} key={i}>
              {m.text && <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>}
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
        </div>
        <div className="quickchips">
          {QUICK.map((q) => (
            <button key={q} onClick={() => send(q)}>{q}</button>
          ))}
        </div>
        <div className="chatinput">
          <input
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

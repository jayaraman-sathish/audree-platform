import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useChat } from "../context/ChatContext";


// Command Workspace -- rebuilt to match the approved mockup (dark sidebar
// already lives in App.jsx/styles.css; this is the landing page content:
// greeting header + status pills, a Copilot prompt box, four real KPI
// cards, Priority Decisions, Enterprise Connections, Decision Activity).
// Every number here is real: KPIs/priority-decisions/connector_plants come
// from /api/v1/kpis + /api/v1/priority-decisions (both backed by actual
// ScenarioRun/AgentToolExecution rows and a live WMPS connection check --
// see routes_misc.py). There is no real Finance ERP connection in this
// platform, so no rupee/financial figures are shown here at all -- rather
// than fabricate them, they're simply omitted until a real source exists.

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function CommandWorkspace() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { setPendingPrompt } = useChat();
  const [prompt, setPrompt] = useState("");

  const kpis = useQuery({ queryKey: ["kpis"], queryFn: () => api.get("/api/v1/kpis").then((r) => r.data) });
  const priority = useQuery({ queryKey: ["priority-decisions"], queryFn: () => api.get("/api/v1/priority-decisions").then((r) => r.data) });
  const feed = useQuery({ queryKey: ["feed"], queryFn: () => api.get("/api/v1/feed").then((r) => r.data) });

  function submitPrompt(e) {
    e.preventDefault();
    const q = prompt.trim();
    if (!q) return;
    setPendingPrompt(q);
    navigate("/copilot");
  }

  const connectorOk = kpis.data?.connector_health && !kpis.data.connector_health.startsWith("0/");

  return (
    <div>
      <div className="cw-header">
        <div>
          <h1>{greeting()}, {user?.full_name?.split(" ")[0] || "there"}</h1>
          <p>Here's what needs your attention across production, inventory, and warehouse operations right now.</p>
        </div>
        <div className="cw-pills">
          <span className={`pill ${connectorOk ? "on" : ""}`}>WMPS: {kpis.data?.connector_health ?? "…"}</span>
          <span className="pill">{kpis.data?.active_scenarios ?? "…"} scenarios active</span>
        </div>
      </div>

      <form className="cw-prompt card" onSubmit={submitPrompt}>
        <label htmlFor="cw-ask">Ask Enterprise Copilot</label>
        <div className="cw-prompt-row">
          <input
            id="cw-ask"
            type="text"
            placeholder='e.g. "current stock of ABIRATERONE ACETATE" or "material availability for DOLUTEGRAVIR SODIUM 650"'
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button className="btn primary" type="submit">Ask →</button>
        </div>
      </form>

      <div className="kpis">
        <div className="card kpi">
          <div className="label">Decisions today</div>
          <div className="value">{kpis.data?.tasks_this_month ?? "…"}</div>
          <div className="sub">requests via Enterprise Copilot</div>
        </div>
        <div className="card kpi">
          <div className="label">Awaiting approval</div>
          <div className="value">{kpis.data?.awaiting_approval ?? "…"}</div>
          <div className="sub">pending human-in-the-loop review</div>
        </div>
        <div className="card kpi">
          <div className="label">At-risk commitments</div>
          <div className="value">{kpis.data?.at_risk ?? "…"}</div>
          <div className="sub">High/Medium risk, pending approval</div>
        </div>
        <div className="card kpi">
          <div className="label">Connected systems</div>
          <div className="value" style={{ color: connectorOk ? "var(--ok)" : "var(--err)" }}>{kpis.data?.connector_health ?? "…"}</div>
          <div className="sub">live WMPS plant connections</div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <h2>Priority decisions</h2>
          <ul className="feed">
            {priority.isLoading && <li>Loading…</li>}
            {priority.data && priority.data.length === 0 && (
              <li style={{ color: "var(--ink-soft)" }}>Nothing pending approval right now.</li>
            )}
            {priority.data?.map((p) => (
              <li key={p.id}>
                <b>{p.workflow_name || p.intent_code}</b>{" "}
                <span className={`cs ${p.risk === "High" ? "err" : p.risk === "Medium" ? "warn" : "ok"}`}>{p.risk} risk</span>
                <br />
                <span style={{ fontSize: ".82rem" }}>{p.utterance}</span>
                <br />
                <span className="mono" style={{ fontSize: ".68rem", color: "var(--ink-soft)" }}>
                  confidence {p.confidence != null ? Math.round(p.confidence * 100) + "%" : "—"} · {p.decision}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2>Enterprise connections</h2>
          <ul className="feed">
            {kpis.isLoading && <li>Loading…</li>}
            {kpis.data?.connector_plants?.length === 0 && (
              <li style={{ color: "var(--ink-soft)" }}>No WMPS plant connections configured.</li>
            )}
            {kpis.data?.connector_plants?.map((p) => (
              <li key={p.name}>
                <span className={`cs ${p.ok ? "ok" : "err"}`}>{p.ok ? "Connected" : "Unavailable"}</span> {p.name}
              </li>
            ))}
          </ul>
          <p className="hint" style={{ marginTop: 10 }}>
            Live connectivity to configured WMPS SQL Server plants only. No SAP/Finance/CRM
            connectors exist yet, so none are shown here.
          </p>
        </div>
      </div>

      <div className="card">
        <h2>Decision activity</h2>
        <ul className="feed">
          {feed.isLoading && <li>Loading…</li>}
          {feed.data?.map((f) => (
            <li key={f.id}>
              <span className="mono" style={{ color: "var(--ink-soft)", fontSize: ".7rem" }}>
                {new Date(f.created_at).toLocaleString()}
              </span>
              <br />
              {f.message}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

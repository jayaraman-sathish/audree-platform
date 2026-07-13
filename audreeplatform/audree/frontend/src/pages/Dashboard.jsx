import { useQuery } from "@tanstack/react-query";
import api from "../api/client";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const kpis = useQuery({ queryKey: ["kpis"], queryFn: () => api.get("/api/v1/kpis").then((r) => r.data) });
  const feed = useQuery({ queryKey: ["feed"], queryFn: () => api.get("/api/v1/feed").then((r) => r.data) });
  const scenarios = useQuery({ queryKey: ["scenarios"], queryFn: () => api.get("/api/v1/scenarios").then((r) => r.data) });

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Dashboard</h1>
          <p>Enterprise Copilot — one intelligent interface above SAP, WMS, LIMS/QMS, CRM and Finance. Intent-driven, explainable, human-in-the-loop.</p>
        </div>
        <Link className="btn primary" to="/studio">✚ Configure scenario</Link>
      </div>

      <div className="kpis">
        <div className="card kpi"><div className="label">Active scenarios</div><div className="value">{kpis.data?.active_scenarios ?? "…"}</div><div className="sub">configured intents</div></div>
        <div className="card kpi"><div className="label">Requests this month</div><div className="value">{kpis.data?.tasks_this_month ?? "…"}</div><div className="sub">via Enterprise Copilot</div></div>
        <div className="card kpi"><div className="label">Human approvals</div><div className="value">{kpis.data?.human_approvals ?? "…"}</div><div className="sub">HITL decisions</div></div>
        <div className="card kpi"><div className="label">Avg response</div><div className="value">{kpis.data?.avg_response_seconds ?? "—"}s</div><div className="sub">vs ≤30s target</div></div>
        <div className="card kpi"><div className="label">Connector health</div><div className="value" style={{ color: "var(--ok)" }}>{kpis.data?.connector_health ?? "6/6"}</div><div className="sub">SAP · WMS · LIMS/QMS · CRM · Finance · MES</div></div>
      </div>

      <div className="dash-grid">
        <div className="card">
          <h2>Recent runtime activity</h2>
          <ul className="feed">
            {feed.isLoading && <li>Loading…</li>}
            {feed.data?.map((f) => (
              <li key={f.id}><span className="mono" style={{ color: "var(--ink-soft)", fontSize: ".7rem" }}>{new Date(f.created_at).toLocaleString()}</span><br />{f.message}</li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2>Business scenario library <span className="pill">BR-001 … BR-007</span></h2>
          <ul className="feed">
            {scenarios.data?.map((s) => (
              <li key={s.id}><b>{s.name}</b><br /><span className="mono" style={{ fontSize: ".68rem", color: "var(--ink-soft)" }}>{s.br_code} · {s.intent_code} · {s.owner}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

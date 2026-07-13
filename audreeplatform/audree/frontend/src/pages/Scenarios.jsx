import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "../api/client";

export default function Scenarios() {
  const { data, isLoading } = useQuery({ queryKey: ["scenarios"], queryFn: () => api.get("/api/v1/scenarios").then((r) => r.data) });

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Business Scenarios</h1>
          <p>Deployed intents. Ask the Enterprise Copilot a matching question to walk the full flow: intent → context → orchestration → standard agent outputs → decision → HITL → writeback.</p>
        </div>
        <Link className="btn primary" to="/studio">✚ Configure scenario</Link>
      </div>
      {isLoading && <p>Loading…</p>}
      <div className="agent-grid">
        {data?.map((s) => (
          <div className="card agent-card" key={s.id}>
            <div className="row">
              <h3>{s.name}</h3>
              <span className="pill sys">{s.br_code}</span>
            </div>
            <div className="mono" style={{ fontSize: ".68rem", color: "var(--ink-soft)" }}>{s.intent_code} · {s.industry} · owner: {s.owner} · {s.perf_target}</div>
            <p className="desc">{s.description}</p>
            <div className="pills">
              {s.caps?.slice(0, 5).map((c) => <span className="pill" key={c}>{c}</span>)}
            </div>
            <div className="hint">Workflow: {s.rules?.some((r) => r.gate) ? "Requires human approval" : "No approval gate"}</div>
            <div className="actions" style={{ marginTop: 10 }}>
              <Link className="btn primary" to="/copilot">▶ Run in Copilot</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

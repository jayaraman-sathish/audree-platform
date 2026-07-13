import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

const EMPTY = {
  br_code: "NEW", intent_code: "", name: "", industry: "", owner: "", perf_target: "≤ 30 seconds",
  description: "", goal: "", plan_text: "", outputs_text: "", caps: [], agents: [], systems: [], kb: [],
  tools: [], rules: [], notif: [],
};

export default function ScenarioStudio() {
  const [form, setForm] = useState(EMPTY);
  const qc = useQueryClient();
  const nav = useNavigate();
  const intents = useQuery({ queryKey: ["master", "intent"], queryFn: () => api.get("/api/v1/masters/intent").then((r) => r.data) });

  const deploy = useMutation({
    mutationFn: () => api.post("/api/v1/scenarios", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["scenarios"] }); nav("/scenarios"); },
  });

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }
  function listField(k, v) { set(k, v.split(",").map((x) => x.trim()).filter(Boolean)); }

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Scenario Studio</h1>
          <p>Configure a business intent through masters — no code. Publishing writes a new active scenario tied to the Intent Master.</p>
        </div>
      </div>
      <div className="card">
        <h2>Intent profile</h2>
        <div className="form-grid">
          <div>
            <label>Scenario name</label>
            <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Order Commitment Check" />
          </div>
          <div>
            <label>Intent code (must exist in Intent Master)</label>
            <select value={form.intent_code} onChange={(e) => set("intent_code", e.target.value)}>
              <option value="">— select —</option>
              {intents.data?.rows.map((r) => <option key={r.id} value={r.data["Intent Code"]}>{r.data["Intent Code"]} — {r.data["Intent Name"]}</option>)}
            </select>
          </div>
          <div><label>Business owner / approver role</label><input type="text" value={form.owner} onChange={(e) => set("owner", e.target.value)} /></div>
          <div><label>Industry / category</label><input type="text" value={form.industry} onChange={(e) => set("industry", e.target.value)} /></div>
          <div style={{ gridColumn: "1/-1" }}><label>Business objective</label><textarea rows={3} value={form.goal} onChange={(e) => set("goal", e.target.value)} /></div>
          <div style={{ gridColumn: "1/-1" }}><label>Description</label><textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} /></div>
          <div><label>Capabilities (comma-separated)</label><input type="text" onChange={(e) => listField("caps", e.target.value)} placeholder="Material Check, Capacity Check" /></div>
          <div><label>Agents (comma-separated)</label><input type="text" onChange={(e) => listField("agents", e.target.value)} placeholder="Inventory Agent, Capacity Agent" /></div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="btn primary" disabled={!form.name || !form.intent_code || deploy.isPending} onClick={() => deploy.mutate()}>
            {deploy.isPending ? "Publishing…" : "Publish scenario"}
          </button>
        </div>
        {deploy.isError && <p className="error">{deploy.error?.response?.data?.detail || "Failed to publish"}</p>}
        <p className="hint" style={{ marginTop: 16 }}>
          On publish this becomes an Active scenario in rt.scenarios, tied to the selected Intent Master row. It inherits platform governance: SSO &amp; role permissions, Correlation-ID traceability, immutable audit and monitoring.
        </p>
      </div>
    </div>
  );
}

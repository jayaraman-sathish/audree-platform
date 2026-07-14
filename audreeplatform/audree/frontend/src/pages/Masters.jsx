import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Masters() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["masters"], queryFn: () => api.get("/api/v1/masters").then((r) => r.data) });
  const [active, setActive] = useState("intent");
  const [editing, setEditing] = useState(null); // {id, values}

  const detail = useQuery({
    queryKey: ["master", active],
    queryFn: () => api.get(`/api/v1/masters/${active}`).then((r) => r.data),
    enabled: !!active,
  });

  // Referential-integrity dropdown sources: always fetched (small masters), regardless of the
  // active tab, so cross-master reference columns (Capability, Primary/Fallback Agent, Intent)
  // can be rendered as selects populated from the OTHER master's live/active rows, never free text.
  const capRef = useQuery({ queryKey: ["master", "cap"], queryFn: () => api.get("/api/v1/masters/cap").then((r) => r.data) });
  const agentRef = useQuery({ queryKey: ["master", "agent"], queryFn: () => api.get("/api/v1/masters/agent").then((r) => r.data) });
  const intentRef = useQuery({ queryKey: ["master", "intent"], queryFn: () => api.get("/api/v1/masters/intent").then((r) => r.data) });

  const activeRowsOf = (data) => (data?.rows || []).filter((r) => String(r.data?.Status ?? "Active").trim().toLowerCase() === "active");
  const capComboOptions = () => activeRowsOf(capRef.data).map((r) => `${r.data["Capability Name"]} (${r.data["Capability Code"]})`);
  const agentNameOptions = () => activeRowsOf(agentRef.data).map((r) => r.data["Agent Name"]);
  const intentCodeOptions = () => activeRowsOf(intentRef.data).map((r) => r.data["Intent Code"]);
  const roleIntentOptions = () => activeRowsOf(intentRef.data).map((r) => `${r.data["Intent Code"]} ${r.data["Intent Name"]}`);
  const capToken = (code) => { const p = String(code).split("-"); return p.length > 1 ? p[1] : String(code); };
  const computePossibleAgents = (capCode) => {
    const token = capToken(capCode);
    const names = [];
    activeRowsOf(agentRef.data).forEach((r) => {
      const toks = String(r.data["Supported Capabilities"] || "").split(",").map((s) => s.trim().split(" ")[0]).filter(Boolean);
      if (toks.includes(token)) names.push(r.data["Agent Name"]);
    });
    return names.join(", ");
  };

  function fieldKind(masterId, col) {
    if (masterId === "cap" && col === "Possible Agents") return "computed";
    if (masterId === "iam" && col === "Capability") return "cap-combo";
    if (col === "Primary Agent" || col === "Fallback Agent") return "agent-name";
    if (masterId === "wf" && col === "Intent") return "intent-code";
    if (masterId === "role" && col === "Intent") return "role-intent";
    return "text";
  }

  function renderField(col, value, onChange, rowValues) {
    const kind = fieldKind(active, col);
    if (kind === "computed") {
      const capCode = rowValues ? rowValues["Capability Code"] : value;
      return <input className="cellinput" value={computePossibleAgents(capCode)} disabled title="Derived from Agent Register — cannot be edited directly" />;
    }
    let options = null;
    if (kind === "cap-combo") options = capComboOptions();
    else if (kind === "agent-name") options = agentNameOptions();
    else if (kind === "intent-code") options = intentCodeOptions();
    else if (kind === "role-intent") options = roleIntentOptions();
    if (options) {
      const opts = value && !options.includes(value) ? [value, ...options] : options;
      return (
        <select className="cellinput" value={value} onChange={onChange}>
          <option value="">— select —</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return <input className="cellinput" value={value} onChange={onChange} />;
  }

  const save = useMutation({
    mutationFn: ({ id, data }) => (id
      ? api.put(`/api/v1/masters/${active}/rows/${id}`, { data })
      : api.post(`/api/v1/masters/${active}/rows`, { data })),
    onSuccess: () => { setEditing(null); qc.invalidateQueries({ queryKey: ["master", active] }); qc.invalidateQueries({ queryKey: ["masters"] }); },
  });

  const del = useMutation({
    mutationFn: (id) => api.delete(`/api/v1/masters/${active}/rows/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["master", active] }); qc.invalidateQueries({ queryKey: ["masters"] }); },
  });

  const publish = useMutation({
    mutationFn: () => api.post(`/api/v1/masters/${active}/publish`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["master", active] }); qc.invalidateQueries({ queryKey: ["masters"] }); },
  });

  function startEdit(row, cols) {
    setEditing({ id: row?.id ?? null, values: cols.reduce((acc, c) => ({ ...acc, [c]: row?.data?.[c] ?? "" }), {}) });
  }

  const m = detail.data;

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Configuration Masters</h1>
          <p>The metadata that drives the platform — configuration over code. Editing is admin-only, version-controlled and publish-approved; the runtime always uses the last published version.</p>
        </div>
      </div>
      <div className="mtabs">
        {list.data?.map((t) => (
          <button key={t.id} className={`mtab ${active === t.id ? "active" : ""}`} onClick={() => { setActive(t.id); setEditing(null); }}>
            {t.title}{t.draft_count > 0 ? " ●" : ""}
          </button>
        ))}
      </div>
      {m && (
        <div className="card tbl-wrap">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h2 style={{ marginBottom: 0 }}>{m.title} <span className="pill sys">{m.version}</span> {m.draft_count > 0 ? <span className="pill human">{m.draft_count} DRAFT CHANGE(S)</span> : <span className="pill on">PUBLISHED</span>}</h2>
            {isAdmin && (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn primary" onClick={() => startEdit(null, m.cols)}>＋ Add row</button>
                {m.draft_count > 0 && <button className="btn human" onClick={() => publish.mutate()}>✓ Publish version</button>}
              </div>
            )}
          </div>
          <table>
            <thead><tr>{m.cols.map((c) => <th key={c}>{c}</th>)}{isAdmin && <th>Actions</th>}</tr></thead>
            <tbody>
              {editing && editing.id === null && (
                <tr>
                  {m.cols.map((c) => (
                    <td key={c}>{renderField(c, editing.values[c], (e) => setEditing({ ...editing, values: { ...editing.values, [c]: e.target.value } }), editing.values)}</td>
                  ))}
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn primary" onClick={() => save.mutate({ id: null, data: editing.values })}>Save</button>{" "}
                    <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
                  </td>
                </tr>
              )}
              {m.rows.map((row) => (
                editing && editing.id === row.id ? (
                  <tr key={row.id}>
                    {m.cols.map((c) => (
                      <td key={c}>{renderField(c, editing.values[c], (e) => setEditing({ ...editing, values: { ...editing.values, [c]: e.target.value } }), editing.values)}</td>
                    ))}
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn primary" onClick={() => save.mutate({ id: row.id, data: editing.values })}>Save</button>{" "}
                      <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={row.id}>
                    {m.cols.map((c, i) => <td key={c} className={i === 0 ? "mono" : ""} style={i === 0 ? { color: "var(--signal)" } : {}}>{String(row.data[c] ?? "")}</td>)}
                    {isAdmin && (
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button className="btn" onClick={() => startEdit(row, m.cols)}>✎</button>{" "}
                        <button className="btn danger" onClick={() => del.mutate(row.id)}>✗</button>
                      </td>
                    )}
                  </tr>
                )
              ))}
            </tbody>
          </table>
          {!isAdmin && <p className="hint" style={{ marginTop: 10 }}>Sign in as the Admin user to add, edit, deactivate or publish rows.</p>}
        </div>
      )}
    </div>
  );
}

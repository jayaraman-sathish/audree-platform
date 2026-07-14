import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";

// Two-level navigation: 13 masters is too many to scan as a flat row, so they are grouped
// into a small number of logical categories. Each master appears in exactly one group.
const MASTER_GROUPS = [
  { id: "intents", label: "Business Intents", masters: ["intent", "input", "outtpl"] },
  { id: "agents", label: "Agents & Capabilities", masters: ["cap", "agent", "iam", "tool"] },
  { id: "rules", label: "Rules & Workflow", masters: ["rule", "wf", "role"] },
  { id: "reference", label: "Reference & Framework", masters: ["out", "ksr", "prompt"] },
];
function groupOfMaster(masterId) {
  return MASTER_GROUPS.find((g) => g.masters.includes(masterId))?.id || MASTER_GROUPS[0].id;
}

// Simple controlled multi-select rendered as a checkbox grid, for cross-reference columns that
// are genuinely multi-valued (e.g. Agent Register's Supported Capabilities). The stored value
// stays a comma-separated string — this only changes how it is captured/edited.
function MultiCheckGrid({ options, value, onChange }) {
  const selected = String(value || "").split(",").map((s) => s.trim()).filter(Boolean);
  const toggle = (v) => {
    const set = new Set(selected);
    if (set.has(v)) set.delete(v); else set.add(v);
    const ordered = options.filter((o) => set.has(o.value)).map((o) => o.value);
    const unknown = selected.filter((s) => s !== v && !options.some((o) => o.value === s));
    onChange([...ordered, ...unknown].join(", "));
  };
  return (
    <div
      className="cellinput"
      style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "4px 10px",
        padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 6, maxHeight: 160, overflowY: "auto",
      }}
    >
      {options.map((o) => (
        <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".78rem" }}>
          <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export default function Masters() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["masters"], queryFn: () => api.get("/api/v1/masters").then((r) => r.data) });
  const [active, setActive] = useState("intent");
  const [activeGroup, setActiveGroup] = useState(groupOfMaster("intent"));
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
  // Agent Register's "Supported Capabilities" is stored as comma-separated capability TOKENS
  // (e.g. "PROD, MAT") — the middle segment of the Capability Registry code (CAP-PROD-001 -> PROD).
  const capTokenOptions = () => activeRowsOf(capRef.data).map((r) => {
    const code = r.data["Capability Code"];
    const token = capToken(code);
    return { value: token, label: `${r.data["Capability Name"]} (${token})` };
  });
  // Intent Master's "Required Capabilities" is stored as comma-separated full Capability Registry
  // codes (e.g. "CAP-PROD-001, CAP-MAT-001").
  const capCodeOptions = () => activeRowsOf(capRef.data).map((r) => {
    const code = r.data["Capability Code"];
    return { value: code, label: `${r.data["Capability Name"]} (${code})` };
  });
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
    if (masterId === "agent" && col === "Supported Capabilities") return "cap-multi-token";
    if (masterId === "intent" && col === "Required Capabilities") return "cap-multi-code";
    return "text";
  }

  // onSet receives the new raw value directly (not an event) so it works uniformly for
  // text/select inputs (onSet(e.target.value)) and the multi-select checkbox grid (onSet(string)).
  function renderField(col, value, onSet, rowValues) {
    const kind = fieldKind(active, col);
    if (kind === "computed") {
      const capCode = rowValues ? rowValues["Capability Code"] : value;
      return <input className="cellinput" value={computePossibleAgents(capCode)} disabled title="Derived from Agent Register — cannot be edited directly" />;
    }
    if (kind === "cap-multi-token" || kind === "cap-multi-code") {
      const options = kind === "cap-multi-token" ? capTokenOptions() : capCodeOptions();
      return <MultiCheckGrid options={options} value={value} onChange={onSet} />;
    }
    let options = null;
    if (kind === "cap-combo") options = capComboOptions();
    else if (kind === "agent-name") options = agentNameOptions();
    else if (kind === "intent-code") options = intentCodeOptions();
    else if (kind === "role-intent") options = roleIntentOptions();
    if (options) {
      const opts = value && !options.includes(value) ? [value, ...options] : options;
      return (
        <select className="cellinput" value={value} onChange={(e) => onSet(e.target.value)}>
          <option value="">— select —</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return <input className="cellinput" value={value} onChange={(e) => onSet(e.target.value)} />;
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
        {MASTER_GROUPS.map((g) => {
          const draftInGroup = (list.data || []).some((t) => g.masters.includes(t.id) && t.draft_count > 0);
          return (
            <button
              key={g.id}
              className={`mtab ${activeGroup === g.id ? "active" : ""}`}
              onClick={() => {
                setActiveGroup(g.id);
                if (!g.masters.includes(active)) setActive(g.masters[0]);
                setEditing(null);
              }}
            >
              {g.label}{draftInGroup ? " ●" : ""}
            </button>
          );
        })}
      </div>
      <div className="mtabs" style={{ marginTop: -10 }}>
        {(list.data || [])
          .filter((t) => MASTER_GROUPS.find((g) => g.id === activeGroup)?.masters.includes(t.id))
          .map((t) => (
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
                    <td key={c}>{renderField(c, editing.values[c], (v) => setEditing({ ...editing, values: { ...editing.values, [c]: v } }), editing.values)}</td>
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
                      <td key={c}>{renderField(c, editing.values[c], (v) => setEditing({ ...editing, values: { ...editing.values, [c]: v } }), editing.values)}</td>
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


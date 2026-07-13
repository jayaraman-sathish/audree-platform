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
                    <td key={c}><input className="cellinput" value={editing.values[c]} onChange={(e) => setEditing({ ...editing, values: { ...editing.values, [c]: e.target.value } })} /></td>
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
                      <td key={c}><input className="cellinput" value={editing.values[c]} onChange={(e) => setEditing({ ...editing, values: { ...editing.values, [c]: e.target.value } })} /></td>
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

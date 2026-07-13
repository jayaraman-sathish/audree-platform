import { useQuery } from "@tanstack/react-query";
import api from "../api/client";

export default function AuditLog() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit"],
    queryFn: () => api.get("/api/v1/audit").then((r) => r.data),
    refetchInterval: 5000,
  });

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Audit Log</h1>
          <p>Every request, intent, agent execution, decision, approval and writeback — traceable by Request ID and Correlation ID.</p>
        </div>
      </div>
      <div className="card tbl-wrap">
        <table>
          <thead><tr><th>Time</th><th>Request / Correlation</th><th>Scenario</th><th>Event</th><th>Detail</th><th>Status</th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={6}>Loading…</td></tr>}
            {data?.map((r) => (
              <tr key={r.id}>
                <td className="mono">{new Date(r.created_at).toLocaleString()}</td>
                <td className="mono">{r.request_id}<br />{r.correlation_id}</td>
                <td>{r.scenario}</td>
                <td className="mono">{r.event_type}</td>
                <td>{r.detail}</td>
                <td><span className={`pill ${r.status === "OK" ? "on" : r.status === "HUMAN" ? "human" : ""}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

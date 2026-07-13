const RT_SEQ = [
  ["RT-001", "User Login & Authentication", "Identity, SSO/MFA, roles, session, audit of login"],
  ["RT-002", "Enterprise Copilot Request", "Capture & validate request, assign Request + Correlation ID"],
  ["RT-003", "Business Intent Identification", "Rule-based classification, entities, confidence"],
  ["RT-004", "Intent Configuration Loading", "Intent, Input, Capability, Agent, Rule & Workflow masters"],
  ["RT-005", "Context Builder Execution", "Entity resolution, unified Business Context Package"],
  ["RT-006", "Knowledge Retrieval Pipeline", "Source Registry → Retrieval Policy → Repository → Security Filter"],
  ["RT-007", "Agent Orchestration", "Execution plan from Intent–Agent Mapping"],
  ["RT-008", "Parallel Agent Execution", "Concurrent agents; Result Aggregator; Standard Output Format"],
  ["RT-009", "Decision Engine Processing", "Rule evaluation, risk scoring, confidence"],
  ["RT-010", "Recommendation Generation", "Can/Cannot Commit · Conditions · Revise Date · Escalate · Hold"],
  ["RT-011", "Workflow Trigger", "Workflow Mapping: decision + risk → approval / task / escalation"],
  ["RT-012", "Human Approval (HITL)", "Approve · Modify · Reject · Escalate"],
  ["RT-013", "Enterprise System Writeback", "Auditable updates via write tools after approval"],
  ["RT-014", "Notification Processing", "Email, Teams, WhatsApp, push, in-app"],
  ["RT-015", "Audit Logging", "Immutable trail + knowledge lineage for every decision"],
  ["RT-016", "Monitoring & Observability", "Health, latency, connectors, queues, error rates"],
];

const PIPELINE = [
  "Business User → Business Request (natural language)",
  "Enterprise Copilot — understands, clarifies, captures parameters",
  "Intent Engine — classifies intent (rule-based), extracts entities, validates inputs",
  "Agent Orchestrator — execution plan from Intent–Agent Mapping",
  "Knowledge Layer — Context Builder + governed retrieval",
  "Agents → Result Aggregator → Decision Engine (explainable, computed)",
  "Workflow Engine — approvals, tasks, escalations (HITL)",
  "Integration Layer — governed writeback to SAP · WMS · CRM …",
  "Monitoring & Learning — audit, lineage, continuous improvement",
];

const AGENT_CATEGORIES = [
  ["AGC-001 Executive", "Enterprise decision support & risk review", "MD Agent, Business Head Agent"],
  ["AGC-002 Functional", "Department business processes & decisions", "PPIC Agent, QA Agent, Finance Agent"],
  ["AGC-003 Domain", "Specific business capability / analytics", "Inventory Agent, Capacity Agent, Risk Agent"],
  ["AGC-004 System", "Governed access to enterprise systems", "SAP Agent, WMS Agent, LIMS Agent, CRM Agent"],
  ["AGC-005 Utility", "Shared platform services", "Notification Agent, Audit Agent, Workflow Agent"],
];

export default function Architecture() {
  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Platform Architecture</h1>
          <p>Business flow, runtime sequences, agent framework — reference documentation for this prototype. See ARCHITECTURE.md in the repo for the full real-vs-simulated breakdown.</p>
        </div>
      </div>
      <div className="card">
        <h2>Request pipeline</h2>
        <ol>{PIPELINE.map((p, i) => <li key={i} style={{ padding: "6px 0" }}>{p}</li>)}</ol>
      </div>
      <div className="card tbl-wrap">
        <h2>Core runtime sequences</h2>
        <table>
          <thead><tr><th>ID</th><th>Runtime sequence</th><th>Responsibility</th></tr></thead>
          <tbody>{RT_SEQ.map((r) => <tr key={r[0]}><td className="mono">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="card tbl-wrap">
        <h2>Agent categories</h2>
        <table>
          <thead><tr><th>Category</th><th>Purpose</th><th>Examples</th></tr></thead>
          <tbody>{AGENT_CATEGORIES.map((r) => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

# Audree — Architecture: what's real vs simulated

This is a working full-stack prototype of the Audree Enterprise Agentic AI
Platform mockup. It replaces every hardcoded JS array and scripted "run"
animation with a real Postgres-backed FastAPI service and a real React
frontend. It is **a demonstration of the architecture**, not a production
ERP integration. Below is an explicit list of what is real and what is
simulated.

## Real (actually implemented)

- **Database**: PostgreSQL, two schemas — `cfg` (configuration masters +
  users) and `rt` (runtime: scenarios, audit_log, runtime_feed, scenario_run,
  simulated enterprise data, chat sessions). Managed with SQLAlchemy models
  and an Alembic migration (`backend/alembic/versions/0001_initial.py`).
- **13 Configuration Masters**: Intent Master, Input Master, Intent–Agent
  Mapping, Capability Registry, Agent Register, Rule Mapping, Workflow
  Mapping, Standard Output Format, Tool Registry, Knowledge Source Registry,
  Role Permission Master, Output Template Master, Prompt Template Master.
  Seeded verbatim from the mockup's `M_*` arrays into `cfg.master_row`
  (JSONB per row, keyed by the same column names shown in the UI) plus
  `cfg.master_version` (per-master version + draft counter).
- **Draft/publish governance**: every add/edit/deactivate creates a
  `status='draft'` row and bumps the master's minor version
  (`app/services/masters.py`, mirrors the mockup's `bumpVer()`). The runtime
  copilot only ever reads `status='published'` rows
  (`masters_svc.published_rows`) — exactly like the mockup's promise that
  "the runtime always uses the last published version." `POST
  /masters/{id}/publish` promotes all current drafts in one step, mirroring
  `publishMaster()`.
- **Business Scenarios (BR-001..BR-007)**: persisted in `rt.scenarios`
  (not a JS array), seeded from the mockup's `TEMPLATES`. Scenario Studio
  writes new rows here via a real POST.
- **Enterprise Copilot decision engine**: `app/services/copilot.py` is a
  line-by-line port of the mockup's `classifyMsg()` / `extractEntities()` /
  `runCommit()` / `runOther()` — regex-based intent classification against
  the seeded Intent Master, entity extraction (product, quantity, date,
  plant, batch, line), a mandatory-field clarification loop driven by the
  live Input Master, and a computed Order Commitment decision: material
  gap math against `rt.sim_material_inventory`, capacity/finish-date math
  against `rt.sim_line` line-free dates and product production rate, QC
  release-day math against `rt.sim_qc`, and workflow routing resolved by
  looking up the *published* Workflow Mapping master rows for the computed
  decision. None of this is scripted or canned — change the simulated data
  or the Workflow Mapping master and the next answer changes accordingly,
  exactly as the mockup's admin panel demonstrated.
- **HITL approval**: `POST /api/v1/copilot/approve` (approve / modify /
  reject / escalate) updates `rt.scenario_run.status` and appends to
  `rt.audit_log`, mirroring `chatApprove()` / `resolveApproval()`.
- **Audit & runtime feed**: every intent classification, clarification,
  decision, approval, writeback, escalation, and config change writes a row
  to `rt.audit_log` with request/correlation IDs, plus a human-readable line
  to `rt.runtime_feed` for the dashboard.
- **JWT auth**: seeded users (`admin`, `ppic.user`, `ppic.head`, `qa.head`,
  `md`, `procurement.head`, `plant.head`, `warehouse.head`) with roles drawn
  from the Role Permission Master. Configuration Masters write endpoints
  require `role == "Admin"`; login issues a JWT consumed by the React app.
- **React frontend**: real components (Dashboard, Enterprise Copilot,
  Scenario Studio, Business Scenarios, Configuration Masters editor,
  Platform Architecture, Audit Log) using React Query + axios against the
  live API — no hardcoded content driving the masters/scenarios/copilot
  views.

## Simulated (explicitly, by design — this is a prototype)

- **SAP / WMS / LIMS / CRM / Finance / MES**: there are no real ERP
  connections. `rt.sim_product`, `rt.sim_material_inventory`, `rt.sim_line`
  and `rt.sim_qc` are an in-database dataset standing in for those systems,
  exactly like the mockup's "⚙ SIMULATED ENTERPRISE DATA" panel. It is
  editable via `GET/PUT /api/v1/sim/*` (admin-only for writes) so you can
  change a material's stock or a line's free-from date and immediately see
  the Enterprise Copilot's next decision change — because the decision is
  *computed* from this data, not replayed.
- **LLM intent classification**: `classify_message()` is deterministic
  regex/keyword matching against the seeded Intent Master and a handful of
  entity patterns (dates, quantities, product/material aliases). There is
  no call to any language model. This mirrors the mockup precisely (its
  comment says "hybrid classification" but the actual JS is the same
  regex-based approach implemented here).
- **"Other" intents** (Production Feasibility, Material Availability,
  Procurement, Replenishment, Batch Release, Executive KPI) reuse the same
  simulated line/inventory tables where the math is meaningful (inventory
  status, production plan) and otherwise return the same representative
  figures the mockup used (e.g. the Excipient E-204 shortage, the ₹2.1 Cr
  cash-flow figure) — these are documented business scenarios (BR-003
  .. BR-007) rather than fully generalized computations; BR-001 (Order
  Commitment) is the fully computed reference pipeline requested.
- **Platform Architecture page**: the request pipeline, runtime sequence
  table and agent category table are reference documentation (Phases 1–4 /
  Runtime Handbook content from the mockup) rendered as static content —
  they describe the target architecture rather than being config rows,
  matching the mockup's own treatment of this view.

## Why this split

The brief was to turn the mockup into a real, running application without
inventing a production ERP integration or wiring a real LLM. Every piece
that the mockup faked with a JS constant and a `setTimeout` animation is now
backed by a Postgres table and computed on the fly; every piece that would
require a genuine SAP/WMS/LIMS contract or a hosted LLM stays clearly
labelled as simulated, editable metadata — which is also exactly what the
original mockup's own copy said it was standing in for.

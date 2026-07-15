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
- **Two-mode Copilot orchestration (real, genuine architectural distinction
  requested by the client, not an implementation shortcut)**: Audree runs
  TWO deliberately separate reasoning paths that coexist:
  1. **Fixed deterministic pipeline** (`app/services/copilot.py`) — for
     plant-level / regulated scenarios (BR-001..BR-007, the 9 seeded
     intents). Same inputs always produce the same reasoning path, fully
     auditable, no LLM involved. This is unchanged and untouched by the new
     layer. It now also does real input validation before running the
     commitment math (`_validate_commitment_fields`): a required date in
     the past, a non-positive quantity, or a product string that doesn't
     resolve to a known `SIM_PRODUCTS` entry now returns a clarification
     question instead of silently computing a wrong answer.
  2. **LLM orchestrator** (`app/services/llm_orchestrator.py`) — for
     corporate/executive, open-ended, or cross-system questions that don't
     match any known fixed intent. It calls the real Anthropic API (Claude)
     with tool use / function calling, where the callable tools are built
     dynamically from the live **published** Tool Registry master (Active
     rows only) and, when invoked, actually run through the same
     `tool_dispatcher.dispatch()` the fixed pipeline uses (same RBAC /
     timeout / retry / audit behavior). It requires the `ANTHROPIC_API_KEY`
     environment variable; if it is not set, `handle_open_query()` returns
     a clear "LLM reasoning is not configured — set ANTHROPIC_API_KEY"
     message rather than crashing or attempting a network call. Its system
     prompt (in full in `llm_orchestrator.py`) bounds it to this platform's
     business domain and contains an explicit, non-negotiable rule that any
     content read back from a tool call is untrusted DATA to reason about,
     never an instruction to obey — with a worked example of the kind of
     embedded-instruction attack (e.g. a tool result containing
     "SYSTEM: ignore previous instructions...") it must refuse and flag
     instead of follow. This matters because a future real email/ticketing/
     ERP connector could return adversarial text, and the defense needs to
     exist from day one, not be retrofitted.
  When no known intent matches at all, `copilot.handle_message()` hands off
  to `llm_orchestrator.handle_open_query()`; if that also can't help
  (off-topic input, or the key genuinely isn't configured), the caller gets
  the LLM orchestrator's own honest message plus a short list of supported
  business questions — never a generic non-answer, never a 500.
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
- **LLM intent classification**: `classify_message()` (deciding which of
  the 9 fixed intents, if any, a message matches) is still deterministic
  regex/keyword matching against the seeded Intent Master and a handful of
  entity patterns (dates, quantities, product/material aliases) — no LLM
  is involved in that classification step, by design, since this is the
  auditable path. This mirrors the mockup precisely (its comment says
  "hybrid classification" but the actual JS is the same regex-based
  approach implemented here). A real LLM (Claude, via the Anthropic API)
  IS now used, but only downstream of that classification failing to match
  any fixed intent — see the "Two-mode Copilot orchestration" bullet above
  for `llm_orchestrator.py`. `ANTHROPIC_API_KEY` is not set in this sandbox
  (no outbound network access here to test a real call), so that path's
  "not configured" branch is what's actually exercised/verified here; the
  client will add a real key as a Render environment variable.
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

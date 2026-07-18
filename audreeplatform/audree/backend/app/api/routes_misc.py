import datetime as dt

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models.models import User, AuditLog, RuntimeFeed, SimProduct, SimMaterialInventory, SimLine, SimQC, \
    ScenarioRun, AgentToolExecution, Scenario
from app.services import wms_db

router = APIRouter(prefix="/api/v1", tags=["audit"])


@router.get("/audit")
def list_audit(limit: int = 200, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(limit).all()
    return [{"id": r.id, "request_id": r.request_id, "correlation_id": r.correlation_id, "scenario": r.scenario,
             "event_type": r.event_type, "detail": r.detail, "status": r.status,
             "created_at": r.created_at.isoformat()} for r in rows]


@router.get("/feed")
def list_feed(limit: int = 30, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(RuntimeFeed).order_by(RuntimeFeed.id.desc()).limit(limit).all()
    return [{"id": r.id, "message": r.message, "created_at": r.created_at.isoformat()} for r in rows]


@router.get("/runs")
def list_runs(limit: int = 50, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(ScenarioRun).order_by(ScenarioRun.id.desc()).limit(limit).all()
    return [{"id": r.id, "request_id": r.request_id, "correlation_id": r.correlation_id,
             "intent_code": r.intent_code, "decision": r.decision, "risk": r.risk, "confidence": r.confidence,
             "workflow_name": r.workflow_name, "approver_role": r.approver_role, "status": r.status,
             "created_at": r.created_at.isoformat()} for r in rows]


@router.get("/tool-executions")
def list_tool_executions(limit: int = 200, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Real dispatch history from rt.agent_tool_execution -- for the Audit
    Log view / a future Tool Registry detail view to show that tool
    invocations actually happened, not just that they're documented."""
    rows = db.query(AgentToolExecution).order_by(AgentToolExecution.id.desc()).limit(limit).all()
    return [{"id": r.id, "tool_code": r.tool_code, "request_id": r.request_id, "correlation_id": r.correlation_id,
             "status": r.status, "attempts": r.attempts, "execution_time_ms": r.execution_time_ms,
             "params": r.params, "result_summary": r.result_summary, "error_detail": r.error_detail,
             "created_at": r.created_at.isoformat()} for r in rows]


def _check_wmps_connectivity() -> dict:
    """Real, live connectivity check -- opens and immediately closes a short-
    timeout connection to every configured WMPS plant. Replaces the previous
    hardcoded '6/6 SAP/WMS/LIMS/QMS/CRM/Finance/MES' claim, which never
    reflected the real WMPS connections this platform actually depends on
    and would have shown all-green even during the real connection timeouts
    and ODBC errors hit earlier in testing."""
    plants = wms_db.configured_plants()
    if not plants:
        return {"summary": "0/0", "detail": "No WMPS plant connection configured", "plants": []}
    results = []
    for p in plants:
        try:
            conn = wms_db.get_connection(p)
            conn.close()
            results.append({"name": p["name"], "ok": True})
        except Exception as exc:  # noqa: BLE001 -- report every plant, one failure shouldn't hide others
            results.append({"name": p["name"], "ok": False, "error": str(exc)[:180]})
    healthy = sum(1 for r in results if r["ok"])
    return {"summary": f"{healthy}/{len(results)}",
            "detail": ", ".join(r["name"] for r in results), "plants": results}


@router.get("/kpis")
def kpis(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    tasks = db.query(ScenarioRun).count()
    approvals = db.query(ScenarioRun).filter(ScenarioRun.status.in_(["approved", "modified", "rejected",
                                                                       "escalated"])).count()
    awaiting_approval = db.query(ScenarioRun).filter(ScenarioRun.status == "pending_approval").count()
    at_risk = db.query(ScenarioRun).filter(ScenarioRun.risk.in_(["High", "Medium"]),
                                            ScenarioRun.status == "pending_approval").count()
    active_scenarios = db.query(Scenario).filter(Scenario.status == "Active").count()
    # Real average tool-execution time from actual dispatch history
    # (rt.agent_tool_execution.execution_time_ms), replacing the previous
    # hardcoded "24" that never reflected anything real.
    avg_ms = db.query(func.avg(AgentToolExecution.execution_time_ms)).filter(
        AgentToolExecution.execution_time_ms.isnot(None)).scalar()
    avg_response_seconds = round(avg_ms / 1000, 1) if avg_ms is not None else None
    connectivity = _check_wmps_connectivity()
    return {"active_scenarios": active_scenarios, "tasks_this_month": tasks,
            "human_approvals": approvals, "awaiting_approval": awaiting_approval, "at_risk": at_risk,
            "avg_response_seconds": avg_response_seconds,
            "connector_health": connectivity["summary"], "connector_detail": connectivity["detail"],
            "connector_plants": connectivity["plants"]}


@router.get("/priority-decisions")
def priority_decisions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Real pending-approval ScenarioRun rows, most urgent first (High risk,
    most recent). Returns an empty list honestly when there are none --
    never fabricated placeholder rows."""
    rows = (db.query(ScenarioRun)
            .filter(ScenarioRun.status == "pending_approval")
            .order_by(ScenarioRun.risk.desc(), ScenarioRun.id.desc())
            .limit(10).all())
    return [{"id": r.id, "request_id": r.request_id, "decision": r.decision, "risk": r.risk,
             "confidence": r.confidence, "workflow_name": r.workflow_name, "utterance": r.utterance,
             "intent_code": r.intent_code} for r in rows]


# ---------------- Simulated enterprise data (admin-editable) ----------------

class SimProductPatch(BaseModel):
    rate: float | None = None


class SimLinePatch(BaseModel):
    free_from: dt.date


class SimQCPatch(BaseModel):
    release_days: int


@router.get("/sim/products")
def sim_products(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [{"key": p.key, "name": p.name, "code": p.code, "line": p.line, "rate": p.rate, "materials": p.materials}
            for p in db.query(SimProduct).all()]


@router.get("/sim/inventory")
def sim_inventory(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [{"material": i.material, "stock": i.stock, "reserved": i.reserved, "uom": i.uom,
             "open_po": i.open_po, "po_eta": i.po_eta.isoformat() if i.po_eta else None}
            for i in db.query(SimMaterialInventory).all()]


@router.get("/sim/lines")
def sim_lines(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [{"line": l.line, "free_from": l.free_from.isoformat()} for l in db.query(SimLine).all()]


@router.get("/sim/qc")
def sim_qc(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    qc = db.query(SimQC).first()
    return {"release_days": qc.release_days if qc else 7}


@router.put("/sim/products/{key}")
def update_sim_product(key: str, body: SimProductPatch, db: Session = Depends(get_db),
                        user: User = Depends(require_admin)):
    p = db.query(SimProduct).filter(SimProduct.key == key).first()
    if body.rate is not None:
        p.rate = body.rate
    db.add(p)
    db.commit()
    return {"key": p.key, "rate": p.rate}


@router.put("/sim/lines/{line}")
def update_sim_line(line: str, body: SimLinePatch, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    l = db.query(SimLine).filter(SimLine.line == line).first()
    l.free_from = body.free_from
    db.add(l)
    db.commit()
    return {"line": l.line, "free_from": l.free_from.isoformat()}


@router.put("/sim/qc")
def update_sim_qc(body: SimQCPatch, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    qc = db.query(SimQC).first()
    qc.release_days = body.release_days
    db.add(qc)
    db.commit()
    return {"release_days": qc.release_days}

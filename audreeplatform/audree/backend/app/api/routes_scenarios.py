from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import User, Scenario
from app.services.audit import add_audit, add_feed, next_request_id, next_correlation_id

router = APIRouter(prefix="/api/v1/scenarios", tags=["scenarios"])


def _out(s: Scenario):
    return {"id": s.id, "br_code": s.br_code, "intent_code": s.intent_code, "name": s.name, "industry": s.industry,
            "owner": s.owner, "perf_target": s.perf_target, "description": s.description, "goal": s.goal,
            "plan_text": s.plan_text, "outputs_text": s.outputs_text, "caps": s.caps, "agents": s.agents,
            "systems": s.systems, "kb": s.kb, "tools": s.tools, "rules": s.rules, "notif": s.notif,
            "status": s.status, "created_at": s.created_at.isoformat() if s.created_at else None}


class ScenarioIn(BaseModel):
    br_code: str | None = "NEW"
    intent_code: str
    name: str
    industry: str | None = None
    owner: str | None = None
    perf_target: str | None = "≤ 30 seconds"
    description: str | None = None
    goal: str | None = None
    plan_text: str | None = None
    outputs_text: str | None = None
    caps: list[str] = []
    agents: list[str] = []
    systems: list[str] = []
    kb: list[str] = []
    tools: list[str] = []
    rules: list[dict] = []
    notif: list[str] = []


@router.get("")
def list_scenarios(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [_out(s) for s in db.query(Scenario).order_by(Scenario.id).all()]


@router.get("/{scenario_id}")
def get_scenario(scenario_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return _out(s)


@router.post("")
def deploy_scenario(body: ScenarioIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = Scenario(**body.model_dump(), status="Active")
    db.add(s)
    db.commit()
    db.refresh(s)
    req, cor = next_request_id(), next_correlation_id()
    add_audit(db, req, cor, s.name, "CONFIG", f"Scenario deployed · {s.intent_code} · published via Scenario Studio",
              "HUMAN")
    add_feed(db, f"Scenario Studio: '{s.name}' ({s.intent_code}) deployed & active")
    return _out(s)


@router.delete("/{scenario_id}")
def deactivate_scenario(scenario_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    s = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Scenario not found")
    s.status = "Inactive"
    db.add(s)
    db.commit()
    req, cor = next_request_id(), next_correlation_id()
    add_audit(db, req, cor, s.name, "CONFIG", "Scenario deactivated", "HUMAN")
    return _out(s)

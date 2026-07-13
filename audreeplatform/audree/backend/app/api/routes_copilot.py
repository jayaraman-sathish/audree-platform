from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.models import User
from app.services import copilot as svc

router = APIRouter(prefix="/api/v1/copilot", tags=["copilot"])


class ChatIn(BaseModel):
    message: str
    session_id: str = "default"


class ConfirmIn(BaseModel):
    request_id: str
    correlation_id: str
    intent_code: str
    session_id: str = "default"
    entities: dict = {}


class ApprovalIn(BaseModel):
    run_id: int
    action: str  # approve | modify | reject | escalate


@router.post("/chat")
def chat(body: ChatIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return svc.handle_message(db, body.message, body.session_id)


@router.post("/confirm")
def confirm(body: ConfirmIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return svc.confirm_intent(db, body.request_id, body.correlation_id, body.intent_code, body.session_id,
                               body.entities)


@router.post("/approve")
def approve(body: ApprovalIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        return svc.resolve_approval(db, body.run_id, body.action, user.role)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

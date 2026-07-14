from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models.models import User
from app.services import masters as svc
from app.services.audit import add_audit, add_feed, next_request_id, next_correlation_id

router = APIRouter(prefix="/api/v1/masters", tags=["masters"])


class RowIn(BaseModel):
    data: dict


class StatusIn(BaseModel):
    is_active: bool


def _row_out(db: Session, master_id: str, row) -> dict:
    return {"id": row.id, "data": svc.present_row_data(db, master_id, row.data, row.code),
            "status": row.status, "is_active": row.is_active, "version_at_write": row.version_at_write}


@router.get("")
def list_masters(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    out = []
    for meta in svc.list_master_ids():
        mv = svc.get_master_meta(db, meta["id"])
        out.append({**meta, "version": mv.version, "draft_count": mv.draft_count})
    return out


@router.get("/{master_id}")
def get_master(master_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        mv = svc.get_master_meta(db, master_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    rows = svc.list_rows(db, master_id)  # includes inactive rows, dimmed client-side
    meta = next(m for m in svc.list_master_ids() if m["id"] == master_id)
    return {"id": master_id, "title": mv.title, "version": mv.version, "draft_count": mv.draft_count,
            "cols": meta["cols"], "note": meta["note"], "json_example": meta["json_example"],
            "rows": [_row_out(db, master_id, r) for r in rows]}


@router.get("/{master_id}/rows/{row_id}/history")
def get_row_history(master_id: str, row_id: int, db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)):
    hist = svc.row_history(db, master_id, row_id)
    return [{"id": h.id, "version_label": h.version_label, "action": h.action, "old_data": h.old_data,
             "new_data": h.new_data, "actor": h.actor, "note": h.note,
             "created_at": h.created_at.isoformat() if h.created_at else None} for h in hist]


@router.post("/{master_id}/rows")
def create_row(master_id: str, body: RowIn, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    try:
        row = svc.create_row(db, master_id, body.data, actor=user.username)
    except svc.ReferenceValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    mv = svc.get_master_meta(db, master_id)
    req, cor = next_request_id(), next_correlation_id()
    add_audit(db, req, cor, mv.title, "CONFIG",
              f"Row added · {row.code} · draft {mv.version} · by {user.username}", "HUMAN")
    add_feed(db, f"{mv.title}: row added ({row.code}) · draft {mv.version} pending publish")
    return _row_out(db, master_id, row)


@router.put("/{master_id}/rows/{row_id}")
def update_row(master_id: str, row_id: int, body: RowIn, db: Session = Depends(get_db),
               user: User = Depends(require_admin)):
    try:
        row, note = svc.update_row(db, master_id, row_id, body.data, actor=user.username)
    except svc.ReferenceValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    mv = svc.get_master_meta(db, master_id)
    req, cor = next_request_id(), next_correlation_id()
    add_audit(db, req, cor, mv.title, "CONFIG",
              f"Row {note} · {row.code} · draft {mv.version} · by {user.username}", "HUMAN")
    add_feed(db, f"{mv.title}: row updated ({row.code}) · draft {mv.version} pending publish")
    return _row_out(db, master_id, row)


@router.delete("/{master_id}/rows/{row_id}")
def deactivate_row(master_id: str, row_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    try:
        row, note = svc.deactivate_row(db, master_id, row_id, actor=user.username)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    mv = svc.get_master_meta(db, master_id)
    req, cor = next_request_id(), next_correlation_id()
    add_audit(db, req, cor, mv.title, "CONFIG",
              f"Row {note} · {row.code} · draft {mv.version} (row retained, excluded from runtime — status toggle, "
              f"not delete) · by {user.username}", "HUMAN")
    add_feed(db, f"{mv.title}: row deactivated ({row.code}) · draft {mv.version} pending publish")
    return _row_out(db, master_id, row)


@router.patch("/{master_id}/rows/{row_id}/status")
def set_row_status(master_id: str, row_id: int, body: StatusIn, db: Session = Depends(get_db),
                    user: User = Depends(require_admin)):
    try:
        row, note = svc.set_row_active(db, master_id, row_id, body.is_active, actor=user.username)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    mv = svc.get_master_meta(db, master_id)
    req, cor = next_request_id(), next_correlation_id()
    add_audit(db, req, cor, mv.title, "CONFIG",
              f"Row {note} · {row.code} · draft {mv.version} · by {user.username}", "HUMAN")
    add_feed(db, f"{mv.title}: row {'reactivated' if body.is_active else 'deactivated'} ({row.code}) · "
                 f"draft {mv.version} pending publish")
    return _row_out(db, master_id, row)


@router.post("/{master_id}/publish")
def publish_master(master_id: str, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    try:
        mv = svc.publish(db, master_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    req, cor = next_request_id(), next_correlation_id()
    add_audit(db, req, cor, mv.title, "PUBLISH",
              f"Version {mv.version} approved & activated — runtime now uses this version", "OK")
    add_feed(db, f"{mv.title} {mv.version} published & active")
    return {"id": master_id, "version": mv.version, "draft_count": mv.draft_count}

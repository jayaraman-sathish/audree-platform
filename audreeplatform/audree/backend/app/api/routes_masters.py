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
    rows = svc.list_rows(db, master_id)
    cols = next(m["cols"] for m in svc.list_master_ids() if m["id"] == master_id)
    return {"id": master_id, "title": mv.title, "version": mv.version, "draft_count": mv.draft_count,
            "cols": cols, "rows": [{"id": r.id, "data": r.data, "status": r.status} for r in rows]}


@router.post("/{master_id}/rows")
def create_row(master_id: str, body: RowIn, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    try:
        row = svc.create_row(db, master_id, body.data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    mv = svc.get_master_meta(db, master_id)
    req, cor = next_request_id(), next_correlation_id()
    add_audit(db, req, cor, mv.title, "CONFIG", f"Row added · {row.code} · draft {mv.version}", "HUMAN")
    add_feed(db, f"{mv.title}: row added ({row.code}) · draft {mv.version} pending publish")
    return {"id": row.id, "data": row.data, "status": row.status}


@router.put("/{master_id}/rows/{row_id}")
def update_row(master_id: str, row_id: int, body: RowIn, db: Session = Depends(get_db),
               user: User = Depends(require_admin)):
    try:
        row = svc.update_row(db, master_id, row_id, body.data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    mv = svc.get_master_meta(db, master_id)
    req, cor = next_request_id(), next_correlation_id()
    add_audit(db, req, cor, mv.title, "CONFIG", f"Row updated · {row.code} · draft {mv.version}", "HUMAN")
    add_feed(db, f"{mv.title}: row updated ({row.code}) · draft {mv.version} pending publish")
    return {"id": row.id, "data": row.data, "status": row.status}


@router.delete("/{master_id}/rows/{row_id}")
def deactivate_row(master_id: str, row_id: int, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    try:
        row = svc.deactivate_row(db, master_id, row_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    mv = svc.get_master_meta(db, master_id)
    req, cor = next_request_id(), next_correlation_id()
    add_audit(db, req, cor, mv.title, "CONFIG",
              f"Row removed · {row.code} · draft {mv.version} (previous version retained for rollback)", "HUMAN")
    add_feed(db, f"{mv.title}: row removed ({row.code}) · draft {mv.version} pending publish")
    return {"id": row.id, "status": "deactivated"}


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

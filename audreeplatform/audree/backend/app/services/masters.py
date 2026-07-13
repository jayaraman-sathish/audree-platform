"""Generic Configuration Master CRUD with version + draft/publish workflow,
mirroring the mockup's bumpVer()/publishMaster() logic: every add/edit/
deactivate creates (or updates) a draft-status row and bumps the master's
minor version; the runtime only ever reads status='published' rows; a
publish action promotes all current drafts to published in one step."""
from sqlalchemy.orm import Session

from app.models import models as m
from app.db.seed_data import MASTERS, MASTER_ORDER


def list_master_ids():
    return [{"id": mid, "title": MASTERS[mid]["title"], "cols": MASTERS[mid]["cols"]} for mid in MASTER_ORDER]


def get_master_meta(db: Session, master_id: str) -> m.MasterVersion:
    mv = db.query(m.MasterVersion).filter(m.MasterVersion.master_id == master_id).first()
    if not mv:
        raise ValueError(f"Unknown master '{master_id}'")
    return mv


def _bump(db: Session, mv: m.MasterVersion):
    major, _, minor = mv.version.lstrip("v").partition(".")
    mv.version = f"v{major}.{int(minor or 0) + 1}"
    mv.draft_count = (mv.draft_count or 0) + 1
    db.add(mv)


def list_rows(db: Session, master_id: str, include_drafts: bool = True):
    q = db.query(m.MasterRow).filter(m.MasterRow.master_id == master_id, m.MasterRow.is_active == True)  # noqa: E712
    if not include_drafts:
        q = q.filter(m.MasterRow.status == "published")
    return q.order_by(m.MasterRow.id).all()


def published_rows(db: Session, master_id: str):
    """What the runtime actually reads -- last published version only."""
    return list_rows(db, master_id, include_drafts=False)


def create_row(db: Session, master_id: str, data: dict) -> m.MasterRow:
    mv = get_master_meta(db, master_id)
    _bump(db, mv)
    cols = MASTERS[master_id]["cols"]
    code = str(data.get(cols[0], "")) if data else ""
    row = m.MasterRow(master_id=master_id, code=code, data=data, status="draft", is_active=True,
                       version_at_write=mv.version)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_row(db: Session, master_id: str, row_id: int, data: dict) -> m.MasterRow:
    mv = get_master_meta(db, master_id)
    row = db.query(m.MasterRow).filter(m.MasterRow.id == row_id, m.MasterRow.master_id == master_id).first()
    if not row:
        raise ValueError("Row not found")
    _bump(db, mv)
    cols = MASTERS[master_id]["cols"]
    row.data = data
    row.code = str(data.get(cols[0], row.code))
    row.status = "draft"
    row.version_at_write = mv.version
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def deactivate_row(db: Session, master_id: str, row_id: int) -> m.MasterRow:
    mv = get_master_meta(db, master_id)
    row = db.query(m.MasterRow).filter(m.MasterRow.id == row_id, m.MasterRow.master_id == master_id).first()
    if not row:
        raise ValueError("Row not found")
    _bump(db, mv)
    row.is_active = False
    row.status = "draft"
    row.version_at_write = mv.version
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def publish(db: Session, master_id: str) -> m.MasterVersion:
    mv = get_master_meta(db, master_id)
    rows = db.query(m.MasterRow).filter(m.MasterRow.master_id == master_id, m.MasterRow.status == "draft").all()
    for row in rows:
        row.status = "published"
        db.add(row)
    mv.draft_count = 0
    db.add(mv)
    db.commit()
    db.refresh(mv)
    return mv

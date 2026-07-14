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


class ReferenceValidationError(ValueError):
    """Raised when a row references another master by a code/name that does
    not currently exist as an active row there (routed to HTTP 400)."""


def _is_active(data: dict) -> bool:
    return str((data or {}).get("Status", "")).strip().lower() == "active"


def _active_data(db: Session, master_id: str):
    return [r.data or {} for r in published_rows(db, master_id) if _is_active(r.data or {})]


def _capability_token(cap_code: str) -> str:
    """CAP-MAT-001 -> MAT (the shorthand token Agent Register uses in its
    'Supported Capabilities' free-text list)."""
    parts = str(cap_code).split("-")
    return parts[1] if len(parts) > 1 else str(cap_code)


def compute_possible_agents(db: Session, cap_code: str) -> str:
    """Capability Registry's 'Possible Agents' is DERIVED, read-only: which
    active Agent Register rows declare support for this capability's token in
    their 'Supported Capabilities' field. Recomputed on every read from the
    live, published Agent Register so it can never drift out of sync (this
    replaces a formerly independently-typed free-text field)."""
    token = _capability_token(cap_code)
    names = []
    for data in _active_data(db, "agent"):
        supported = str(data.get("Supported Capabilities", ""))
        toks = [t.strip().split(" ")[0] for t in supported.split(",") if t.strip()]
        if token in toks:
            name = data.get("Agent Name")
            if name and name not in names:
                names.append(name)
    return ", ".join(names)


def present_row_data(db: Session, master_id: str, data: dict, fallback_code: str = "") -> dict:
    """Applies any read-time computed-field overrides for a master's row
    data. 'cap' -> Possible Agents is always recomputed from Agent Register,
    never taken from what was stored (even if a client tried to submit one)."""
    if master_id == "cap" and data is not None:
        data = dict(data)
        data["Possible Agents"] = compute_possible_agents(db, data.get("Capability Code", fallback_code))
    return data


def validate_row(db: Session, master_id: str, data: dict) -> None:
    """Referential-integrity checks for one-directional reference columns:
    reject rows that point at a code/name that isn't an active row in the
    referenced master, instead of allowing arbitrary free text."""
    if master_id == "iam":
        cap_codes = {d.get("Capability Code") for d in _active_data(db, "cap") if d.get("Capability Code")}
        cap_val = str(data.get("Capability", ""))
        if cap_val and cap_codes and not any(code in cap_val for code in cap_codes):
            raise ReferenceValidationError(
                f"Capability '{cap_val}' does not reference an active Capability Registry code")
        agent_names = {d.get("Agent Name") for d in _active_data(db, "agent") if d.get("Agent Name")}
        for col in ("Primary Agent", "Fallback Agent"):
            val = data.get(col)
            if val and agent_names and val not in agent_names:
                raise ReferenceValidationError(f"{col} '{val}' is not an active Agent Register entry")
    elif master_id == "wf":
        intent_codes = {d.get("Intent Code") for d in _active_data(db, "intent") if d.get("Intent Code")}
        val = data.get("Intent")
        if val and intent_codes and val not in intent_codes:
            raise ReferenceValidationError(f"Intent '{val}' is not an active Intent Master code")
    elif master_id == "role":
        intent_codes = {d.get("Intent Code") for d in _active_data(db, "intent") if d.get("Intent Code")}
        val = str(data.get("Intent", ""))
        if val and intent_codes and not any(val.startswith(code) for code in intent_codes):
            raise ReferenceValidationError(f"Intent '{val}' does not start with an active Intent Master code")


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
    validate_row(db, master_id, data or {})
    if master_id == "cap" and data is not None:
        # Possible Agents can never be manually typed/stored -- it is always
        # derived at read time from Agent Register.
        data = {**data, "Possible Agents": ""}
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
    validate_row(db, master_id, data or {})
    if master_id == "cap" and data is not None:
        data = {**data, "Possible Agents": ""}
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

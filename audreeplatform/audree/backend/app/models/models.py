import datetime as dt

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, Date
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.db.session import Base

UTCNOW = lambda: dt.datetime.utcnow()  # noqa: E731


class User(Base):
    __tablename__ = "user"
    __table_args__ = {"schema": "cfg"}

    id = Column(Integer, primary_key=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    full_name = Column(String(128))
    role = Column(String(64), nullable=False)  # e.g. PPIC User, PPIC Head, QA Head, MD, Admin
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=UTCNOW)


class MasterVersion(Base):
    """Tracks the published version + pending draft count for each of the
    13 Configuration Masters (mirrors mockup's masterVersion/masterDraft)."""
    __tablename__ = "master_version"
    __table_args__ = {"schema": "cfg"}

    master_id = Column(String(32), primary_key=True)  # e.g. 'intent','input','iam',...
    title = Column(String(160), nullable=False)
    version = Column(String(16), nullable=False, default="v1.0")
    draft_count = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime, default=UTCNOW, onupdate=UTCNOW)


class MasterRow(Base):
    """A single configuration row belonging to one of the 13 masters.
    `data` holds the named columns for that master (matches the mockup's
    M_INTENT/M_INPUT/... row column names) as JSONB so every master's
    distinct column set is represented faithfully without 13 bespoke tables.
    status: draft | published. Runtime only ever reads status='published'
    and is_active=True rows -- exactly mirroring bumpVer()/publishMaster()."""
    __tablename__ = "master_row"
    __table_args__ = {"schema": "cfg"}

    id = Column(Integer, primary_key=True)
    master_id = Column(String(32), ForeignKey("cfg.master_version.master_id"), nullable=False, index=True)
    code = Column(String(120))  # first column / natural key, e.g. INT-PPIC-001
    data = Column(JSONB, nullable=False)
    status = Column(String(16), nullable=False, default="published")  # draft|published
    is_active = Column(Boolean, default=True)
    version_at_write = Column(String(16))
    created_at = Column(DateTime, default=UTCNOW)
    updated_at = Column(DateTime, default=UTCNOW, onupdate=UTCNOW)


class Scenario(Base):
    """rt.scenarios -- deployed business scenarios (BR-001..BR-007 + custom),
    tied to an intent code, capabilities, agents, rules, workflow."""
    __tablename__ = "scenarios"
    __table_args__ = {"schema": "rt"}

    id = Column(Integer, primary_key=True)
    br_code = Column(String(16))
    intent_code = Column(String(32), index=True)
    name = Column(String(160), nullable=False)
    industry = Column(String(80))
    owner = Column(String(120))
    perf_target = Column(String(40))
    description = Column(Text)
    goal = Column(Text)
    plan_text = Column(Text)
    outputs_text = Column(Text)
    caps = Column(JSONB, default=list)
    agents = Column(JSONB, default=list)
    systems = Column(JSONB, default=list)
    kb = Column(JSONB, default=list)
    tools = Column(JSONB, default=list)
    rules = Column(JSONB, default=list)
    notif = Column(JSONB, default=list)
    status = Column(String(16), default="Active")
    created_at = Column(DateTime, default=UTCNOW)


class AuditLog(Base):
    __tablename__ = "audit_log"
    __table_args__ = {"schema": "rt"}

    id = Column(Integer, primary_key=True)
    request_id = Column(String(32), index=True)
    correlation_id = Column(String(32), index=True)
    scenario = Column(String(160))
    event_type = Column(String(24))  # INTENT|CLARIFY|DECISION|APPROVAL|WRITEBACK|ESCALATION|CONFIG|PUBLISH
    detail = Column(Text)
    status = Column(String(12))  # OK|HUMAN|ERR
    created_at = Column(DateTime, default=UTCNOW)


class RuntimeFeed(Base):
    __tablename__ = "runtime_feed"
    __table_args__ = {"schema": "rt"}

    id = Column(Integer, primary_key=True)
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=UTCNOW)


class ScenarioRun(Base):
    """A single copilot request/run -- persists the HITL approval state."""
    __tablename__ = "scenario_run"
    __table_args__ = {"schema": "rt"}

    id = Column(Integer, primary_key=True)
    request_id = Column(String(32), index=True)
    correlation_id = Column(String(32), index=True)
    intent_code = Column(String(32))
    utterance = Column(Text)
    entities = Column(JSONB, default=dict)
    decision = Column(String(255))
    risk = Column(String(16))
    confidence = Column(Float)
    workflow_name = Column(String(160))
    approver_role = Column(String(80))
    status = Column(String(24), default="completed")  # completed|pending_approval|approved|modified|rejected|escalated
    created_at = Column(DateTime, default=UTCNOW)
    resolved_at = Column(DateTime)


# ---------------- Simulated enterprise data (admin-editable) ----------------

class SimProduct(Base):
    __tablename__ = "sim_product"
    __table_args__ = {"schema": "rt"}

    key = Column(String(40), primary_key=True)  # amoxicillin, paracetamol, azithromycin
    name = Column(String(160), nullable=False)
    code = Column(String(40))
    line = Column(String(40))
    rate = Column(Float)  # M units/day
    materials = Column(JSONB, default=list)  # [{m, perM, uom}]


class SimMaterialInventory(Base):
    __tablename__ = "sim_material_inventory"
    __table_args__ = {"schema": "rt"}

    material = Column(String(120), primary_key=True)
    stock = Column(Float)
    reserved = Column(Float)
    uom = Column(String(20))
    open_po = Column(Float, default=0)
    po_eta = Column(Date, nullable=True)


class SimLine(Base):
    __tablename__ = "sim_line"
    __table_args__ = {"schema": "rt"}

    line = Column(String(40), primary_key=True)
    free_from = Column(Date)


class SimQC(Base):
    __tablename__ = "sim_qc"
    __table_args__ = {"schema": "rt"}

    id = Column(Integer, primary_key=True)
    release_days = Column(Integer, default=7)


class ChatSession(Base):
    """Session memory for the Enterprise Copilot (episodic recall of the
    last product/plant/date/qty/intent within one conversation)."""
    __tablename__ = "chat_session"
    __table_args__ = {"schema": "rt"}

    session_id = Column(String(64), primary_key=True)
    memory = Column(JSONB, default=dict)
    updated_at = Column(DateTime, default=UTCNOW, onupdate=UTCNOW)

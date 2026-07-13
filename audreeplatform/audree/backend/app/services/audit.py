import random
import string

from sqlalchemy.orm import Session

from app.models import models as m

_req_counter = [10231]
_cor_counter = [88130]


def next_request_id() -> str:
    _req_counter[0] += 1
    return f"REQ-{_req_counter[0]}"


def next_correlation_id() -> str:
    _cor_counter[0] += 1
    return f"COR-{_cor_counter[0]}"


def add_audit(db: Session, request_id: str, correlation_id: str, scenario: str, event_type: str, detail: str,
              status: str) -> m.AuditLog:
    row = m.AuditLog(request_id=request_id, correlation_id=correlation_id, scenario=scenario,
                      event_type=event_type, detail=detail, status=status)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def add_feed(db: Session, message: str) -> m.RuntimeFeed:
    row = m.RuntimeFeed(message=message)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

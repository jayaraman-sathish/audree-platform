"""Seed the database with the 13 Configuration Masters, BR-001..BR-007
scenarios, simulated enterprise data, and demo users. Idempotent: safe to
run multiple times (it clears and re-seeds masters/scenarios/sim data but
leaves audit_log/runtime_feed/scenario_run history untouched unless --wipe).
"""
import sys

from app.db.session import SessionLocal, engine, Base
from app.core.security import hash_password
from app.models import models as m
from app.db.seed_data import (
    MASTERS, MASTER_ORDER, TEMPLATES, SIM_PRODUCTS, SIM_INVENTORY, SIM_LINES,
    SIM_QC_RELEASE_DAYS, SEED_USERS,
)


def run(wipe: bool = False):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if wipe:
            db.query(m.AuditLog).delete()
            db.query(m.RuntimeFeed).delete()
            db.query(m.ScenarioRun).delete()

        db.query(m.MasterRow).delete()
        db.query(m.MasterVersion).delete()
        db.query(m.Scenario).delete()
        db.query(m.SimProduct).delete()
        db.query(m.SimMaterialInventory).delete()
        db.query(m.SimLine).delete()
        db.query(m.SimQC).delete()
        db.commit()

        # 13 Configuration Masters.
        # Parent MasterVersion rows must exist (flushed) before the child
        # MasterRow rows that reference them via master_id, otherwise
        # SQLAlchemy's insertmanyvalues batching can emit the MasterRow
        # inserts before the MasterVersion inserts (there's no ORM-level
        # relationship() tying them together, only a plain FK column), which
        # trips the foreign key constraint. Flush per-master to force order.
        for mid in MASTER_ORDER:
            spec = MASTERS[mid]
            db.add(m.MasterVersion(master_id=mid, title=spec["title"], version="v1.0", draft_count=0))
            db.flush()
            for row in spec["rows"]:
                data = dict(zip(spec["cols"], row))
                db.add(m.MasterRow(master_id=mid, code=str(row[0]), data=data, status="published",
                                    is_active=True, version_at_write="v1.0"))
            db.flush()
        db.commit()

        # Business scenarios BR-001..BR-007
        for t in TEMPLATES:
            db.add(m.Scenario(
                br_code=t["br"], intent_code=t["code"], name=t["name"], industry=t["ind"], owner=t["owner"],
                perf_target=t["perf"], description=t["desc"], goal=t["goal"], plan_text=t["plan"],
                outputs_text=t["outputs"], caps=t["caps"], agents=t["agents"], systems=t["systems"], kb=t["kb"],
                tools=t["tools"], rules=t["rules"], notif=t["notif"], status="Active",
            ))
        db.commit()

        # Simulated enterprise data
        for key, p in SIM_PRODUCTS.items():
            db.add(m.SimProduct(key=key, name=p["name"], code=p["code"], line=p["line"], rate=p["rate"],
                                 materials=p["materials"]))
        for mat, inv in SIM_INVENTORY.items():
            db.add(m.SimMaterialInventory(material=mat, stock=inv["stock"], reserved=inv["reserved"],
                                           uom=inv["uom"], open_po=inv["open_po"], po_eta=inv["po_eta"]))
        for line, free_from in SIM_LINES.items():
            db.add(m.SimLine(line=line, free_from=free_from))
        db.add(m.SimQC(release_days=SIM_QC_RELEASE_DAYS))
        db.commit()

        # Demo users (idempotent)
        for u in SEED_USERS:
            existing = db.query(m.User).filter(m.User.username == u["username"]).first()
            if not existing:
                db.add(m.User(username=u["username"], full_name=u["full_name"], role=u["role"],
                               hashed_password=hash_password(u["password"]), is_active=True))
        db.commit()

        db.add(m.RuntimeFeed(message="Platform seeded: 13 configuration masters, 7 business scenarios, "
                                      "simulated SAP/WMS/LIMS dataset, demo users."))
        db.commit()
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    run(wipe="--wipe" in sys.argv)

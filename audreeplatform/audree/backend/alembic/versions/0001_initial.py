"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-07-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS cfg")
    op.execute("CREATE SCHEMA IF NOT EXISTS rt")

    op.create_table(
        "user",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.String(64), nullable=False, unique=True),
        sa.Column("full_name", sa.String(128)),
        sa.Column("role", sa.String(64), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        schema="cfg",
    )

    op.create_table(
        "master_version",
        sa.Column("master_id", sa.String(32), primary_key=True),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("version", sa.String(16), nullable=False, server_default="v1.0"),
        sa.Column("draft_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
        schema="cfg",
    )

    op.create_table(
        "master_row",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("master_id", sa.String(32), sa.ForeignKey("cfg.master_version.master_id"), nullable=False,
                  index=True),
        sa.Column("code", sa.String(120)),
        sa.Column("data", pg.JSONB, nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="published"),
        sa.Column("is_active", sa.Boolean, server_default=sa.true()),
        sa.Column("version_at_write", sa.String(16)),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
        schema="cfg",
    )

    op.create_table(
        "scenarios",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("br_code", sa.String(16)),
        sa.Column("intent_code", sa.String(32), index=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("industry", sa.String(80)),
        sa.Column("owner", sa.String(120)),
        sa.Column("perf_target", sa.String(40)),
        sa.Column("description", sa.Text),
        sa.Column("goal", sa.Text),
        sa.Column("plan_text", sa.Text),
        sa.Column("outputs_text", sa.Text),
        sa.Column("caps", pg.JSONB),
        sa.Column("agents", pg.JSONB),
        sa.Column("systems", pg.JSONB),
        sa.Column("kb", pg.JSONB),
        sa.Column("tools", pg.JSONB),
        sa.Column("rules", pg.JSONB),
        sa.Column("notif", pg.JSONB),
        sa.Column("status", sa.String(16), server_default="Active"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        schema="rt",
    )

    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("request_id", sa.String(32), index=True),
        sa.Column("correlation_id", sa.String(32), index=True),
        sa.Column("scenario", sa.String(160)),
        sa.Column("event_type", sa.String(24)),
        sa.Column("detail", sa.Text),
        sa.Column("status", sa.String(12)),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        schema="rt",
    )

    op.create_table(
        "runtime_feed",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        schema="rt",
    )

    op.create_table(
        "scenario_run",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("request_id", sa.String(32), index=True),
        sa.Column("correlation_id", sa.String(32), index=True),
        sa.Column("intent_code", sa.String(32)),
        sa.Column("utterance", sa.Text),
        sa.Column("entities", pg.JSONB),
        sa.Column("decision", sa.String(255)),
        sa.Column("risk", sa.String(16)),
        sa.Column("confidence", sa.Float),
        sa.Column("workflow_name", sa.String(160)),
        sa.Column("approver_role", sa.String(80)),
        sa.Column("status", sa.String(24), server_default="completed"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime),
        schema="rt",
    )

    op.create_table(
        "sim_product",
        sa.Column("key", sa.String(40), primary_key=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("code", sa.String(40)),
        sa.Column("line", sa.String(40)),
        sa.Column("rate", sa.Float),
        sa.Column("materials", pg.JSONB),
        schema="rt",
    )

    op.create_table(
        "sim_material_inventory",
        sa.Column("material", sa.String(120), primary_key=True),
        sa.Column("stock", sa.Float),
        sa.Column("reserved", sa.Float),
        sa.Column("uom", sa.String(20)),
        sa.Column("open_po", sa.Float, server_default="0"),
        sa.Column("po_eta", sa.Date, nullable=True),
        schema="rt",
    )

    op.create_table(
        "sim_line",
        sa.Column("line", sa.String(40), primary_key=True),
        sa.Column("free_from", sa.Date),
        schema="rt",
    )

    op.create_table(
        "sim_qc",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("release_days", sa.Integer, server_default="7"),
        schema="rt",
    )

    op.create_table(
        "chat_session",
        sa.Column("session_id", sa.String(64), primary_key=True),
        sa.Column("memory", pg.JSONB),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
        schema="rt",
    )


def downgrade() -> None:
    op.drop_table("chat_session", schema="rt")
    op.drop_table("sim_qc", schema="rt")
    op.drop_table("sim_line", schema="rt")
    op.drop_table("sim_material_inventory", schema="rt")
    op.drop_table("sim_product", schema="rt")
    op.drop_table("scenario_run", schema="rt")
    op.drop_table("runtime_feed", schema="rt")
    op.drop_table("audit_log", schema="rt")
    op.drop_table("scenarios", schema="rt")
    op.drop_table("master_row", schema="cfg")
    op.drop_table("master_version", schema="cfg")
    op.drop_table("user", schema="cfg")

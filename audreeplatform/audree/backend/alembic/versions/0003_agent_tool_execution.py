"""add rt.agent_tool_execution -- real dispatch log for app.services.tool_dispatcher

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-14

Additive only: creates one new table in the existing `rt` schema. No
existing columns are altered, dropped, or made non-nullable, so this
applies cleanly on top of a populated database.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_tool_execution",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("tool_code", sa.String(64), nullable=False, index=True),
        sa.Column("request_id", sa.String(32), index=True),
        sa.Column("correlation_id", sa.String(32), index=True),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="1"),
        sa.Column("execution_time_ms", sa.Integer),
        sa.Column("params", pg.JSONB, nullable=True),
        sa.Column("result_summary", sa.Text),
        sa.Column("error_detail", sa.Text),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        schema="rt",
    )


def downgrade() -> None:
    op.drop_table("agent_tool_execution", schema="rt")

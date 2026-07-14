"""add master_row_history for per-row version history/diff

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-14

Additive only: creates one new table. No existing columns are altered,
dropped, or made non-nullable, so this applies cleanly on top of a
populated database (seeded master_version/master_row rows are untouched).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "master_row_history",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("master_id", sa.String(32), sa.ForeignKey("cfg.master_version.master_id"), nullable=False,
                  index=True),
        sa.Column("row_id", sa.Integer, sa.ForeignKey("cfg.master_row.id"), nullable=False, index=True),
        sa.Column("version_label", sa.String(16)),
        sa.Column("action", sa.String(16), nullable=False),
        sa.Column("old_data", pg.JSONB, nullable=True),
        sa.Column("new_data", pg.JSONB, nullable=True),
        sa.Column("actor", sa.String(120)),
        sa.Column("note", sa.Text),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        schema="cfg",
    )


def downgrade() -> None:
    op.drop_table("master_row_history", schema="cfg")

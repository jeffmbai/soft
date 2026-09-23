"""duty clocks for live floor

Revision ID: 003_duty_clock
Revises: 002_swap_shift_id
Create Date: 2026-03-23
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "003_duty_clock"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "duty_clocks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("assignment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shift_assignments.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("shift_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shifts.id"), nullable=False),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("clocked_in_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("clocked_out_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_duty_clocks_assignment_id", "duty_clocks", ["assignment_id"])


def downgrade() -> None:
    op.drop_index("ix_duty_clocks_assignment_id", table_name="duty_clocks")
    op.drop_table("duty_clocks")

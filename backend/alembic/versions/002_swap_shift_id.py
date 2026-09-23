"""Add shift_id to swap_requests, nullable requester_assignment_id

Revision ID: 002
Revises: 001
Create Date: 2026-09-22

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "swap_requests",
        sa.Column("shift_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.execute(
        """
        UPDATE swap_requests sr
        SET shift_id = sa.shift_id
        FROM shift_assignments sa
        WHERE sr.requester_assignment_id = sa.id
        """
    )
    op.alter_column("swap_requests", "shift_id", nullable=False)
    op.create_foreign_key(
        "fk_swap_requests_shift_id",
        "swap_requests",
        "shifts",
        ["shift_id"],
        ["id"],
    )
    op.alter_column("swap_requests", "requester_assignment_id", nullable=True)


def downgrade() -> None:
    op.alter_column("swap_requests", "requester_assignment_id", nullable=False)
    op.drop_constraint("fk_swap_requests_shift_id", "swap_requests", type_="foreignkey")
    op.drop_column("swap_requests", "shift_id")

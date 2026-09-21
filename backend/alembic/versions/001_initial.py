"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-03-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    user_role = postgresql.ENUM("admin", "manager", "staff", name="user_role", create_type=False)
    skill = postgresql.ENUM("bartender", "line_cook", "server", "host", name="skill", create_type=False)
    shift_skill = postgresql.ENUM("bartender", "line_cook", "server", "host", name="shift_skill", create_type=False)
    shift_status = postgresql.ENUM("draft", "published", name="shift_status", create_type=False)
    assignment_status = postgresql.ENUM("assigned", "pending_swap", name="assignment_status", create_type=False)
    swap_type = postgresql.ENUM("swap", "drop", name="swap_type", create_type=False)
    swap_status = postgresql.ENUM(
        "pending_counterparty", "pending_manager", "approved", "cancelled", "expired", "superseded",
        name="swap_status", create_type=False,
    )

    op.execute("CREATE TYPE user_role AS ENUM ('admin', 'manager', 'staff')")
    op.execute("CREATE TYPE skill AS ENUM ('bartender', 'line_cook', 'server', 'host')")
    op.execute("CREATE TYPE shift_skill AS ENUM ('bartender', 'line_cook', 'server', 'host')")
    op.execute("CREATE TYPE shift_status AS ENUM ('draft', 'published')")
    op.execute("CREATE TYPE assignment_status AS ENUM ('assigned', 'pending_swap')")
    op.execute("CREATE TYPE swap_type AS ENUM ('swap', 'drop')")
    op.execute(
        "CREATE TYPE swap_status AS ENUM "
        "('pending_counterparty', 'pending_manager', 'approved', 'cancelled', 'expired', 'superseded')"
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_users_email", "users", ["email"])

    op.create_table(
        "locations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("timezone", sa.String(64), nullable=False),
        sa.Column("address", sa.String(512), nullable=False),
        sa.Column("schedule_cutoff_hours", sa.Integer(), server_default="48"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "manager_locations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("manager_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id"), nullable=False),
    )

    op.create_table(
        "staff_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), unique=True, nullable=False),
        sa.Column("desired_hours_per_week", sa.Integer(), nullable=True),
        sa.Column("availability_timezone", sa.String(64), server_default="America/Los_Angeles"),
    )

    op.create_table(
        "staff_location_certs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("certified_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("decertified_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "staff_skills",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("skill", skill, nullable=False),
    )

    op.create_table(
        "availability_windows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("timezone", sa.String(64), nullable=False),
    )

    op.create_table(
        "availability_exceptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("is_available", sa.Boolean(), server_default="true"),
        sa.Column("start_time", sa.Time(), nullable=True),
        sa.Column("end_time", sa.Time(), nullable=True),
    )

    op.create_table(
        "shifts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("required_skill", shift_skill, nullable=False),
        sa.Column("headcount", sa.Integer(), server_default="1"),
        sa.Column("status", shift_status, server_default="draft"),
        sa.Column("version", sa.Integer(), server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "shift_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("shift_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shifts.id"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", assignment_status, server_default="assigned"),
        sa.Column("version", sa.Integer(), server_default="1"),
        sa.Column("override_reason", sa.String(512), nullable=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "schedule_weeks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("location_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("locations.id"), nullable=False),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
    )

    op.create_table(
        "swap_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("type", swap_type, nullable=False),
        sa.Column("requester_assignment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shift_assignments.id"), nullable=False),
        sa.Column("target_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("counterpart_assignment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("shift_assignments.id"), nullable=True),
        sa.Column("status", swap_status, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("manager_approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("type", sa.String(64), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.String(1024), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "notification_preferences",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), unique=True, nullable=False),
        sa.Column("in_app", sa.Boolean(), server_default="true"),
        sa.Column("email_sim", sa.Boolean(), server_default="false"),
    )

    op.create_table(
        "email_outbox",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("to_email", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("body", sa.String(4096), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("entity_type", sa.String(64), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("before_state", postgresql.JSONB(), nullable=True),
        sa.Column("after_state", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )


def downgrade() -> None:
    for table in [
        "audit_logs", "email_outbox", "notification_preferences", "notifications",
        "swap_requests", "schedule_weeks", "shift_assignments", "shifts",
        "availability_exceptions", "availability_windows", "staff_skills",
        "staff_location_certs", "staff_profiles", "manager_locations", "locations", "users",
    ]:
        op.drop_table(table)
    for enum in ["swap_status", "swap_type", "assignment_status", "shift_status", "shift_skill", "skill", "user_role"]:
        op.execute(f"DROP TYPE IF EXISTS {enum}")

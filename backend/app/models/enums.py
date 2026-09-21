import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    staff = "staff"


class Skill(str, enum.Enum):
    bartender = "bartender"
    line_cook = "line_cook"
    server = "server"
    host = "host"


class ShiftStatus(str, enum.Enum):
    draft = "draft"
    published = "published"


class AssignmentStatus(str, enum.Enum):
    assigned = "assigned"
    pending_swap = "pending_swap"


class SwapType(str, enum.Enum):
    swap = "swap"
    drop = "drop"


class SwapStatus(str, enum.Enum):
    pending_counterparty = "pending_counterparty"
    pending_manager = "pending_manager"
    approved = "approved"
    cancelled = "cancelled"
    expired = "expired"
    superseded = "superseded"

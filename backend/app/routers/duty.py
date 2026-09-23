from uuid import UUID

from fastapi import APIRouter, Depends
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.duty import ClockActionRequest, DutyFloorResponse, DutySummaryResponse, WsTokenResponse
from app.security import create_ws_token, decode_token
from app.services.duty import clock_in, clock_out, get_floor_snapshot

router = APIRouter(tags=["duty"])


@router.get("/duty/floor", response_model=DutyFloorResponse)
async def get_floor(
    user: User = Depends(require_roles(UserRole.admin, UserRole.manager)),
    db: AsyncSession = Depends(get_db),
):
    return await get_floor_snapshot(db, user)


@router.get("/duty/summary", response_model=DutySummaryResponse)
async def get_duty_summary(
    user: User = Depends(require_roles(UserRole.admin, UserRole.manager)),
    db: AsyncSession = Depends(get_db),
):
    snap = await get_floor_snapshot(db, user)
    return DutySummaryResponse(
        total_clocked_in=snap.total_clocked_in,
        total_scheduled=sum(loc.scheduled_count for loc in snap.locations),
        total_tardy=sum(loc.tardy_count for loc in snap.locations),
        total_gaps=sum(loc.gap_count for loc in snap.locations),
        active_shifts=len(snap.shifts),
    )


@router.post("/duty/ws-token", response_model=WsTokenResponse)
async def issue_ws_token(
    user: User = Depends(require_roles(UserRole.admin, UserRole.manager)),
):
    return WsTokenResponse(token=create_ws_token(str(user.id)), expires_in=300)


@router.post("/duty/clock-in")
async def post_clock_in(
    body: ClockActionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clock = await clock_in(db, user, body.assignment_id)
    await db.commit()
    return {"clock_id": str(clock.id), "clocked_in_at": clock.clocked_in_at.isoformat()}


@router.post("/duty/clock-out")
async def post_clock_out(
    body: ClockActionRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clock = await clock_out(db, user, body.assignment_id)
    await db.commit()
    return {"clock_id": str(clock.id), "clocked_out_at": clock.clocked_out_at.isoformat() if clock.clocked_out_at else None}


async def authenticate_ws_token(token: str, db: AsyncSession) -> User:
    try:
        payload = decode_token(token)
        if payload.get("type") != "ws":
            raise JWTError("Invalid ws token type")
        user_id = UUID(payload["sub"])
    except (JWTError, KeyError, ValueError) as exc:
        raise ValueError("Invalid WebSocket token") from exc

    user = await db.get(User, user_id)
    if not user or user.role not in (UserRole.admin, UserRole.manager):
        raise ValueError("WebSocket not allowed for this user")
    return user

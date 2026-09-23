from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.enums import SwapStatus, SwapType, UserRole
from app.models.shift import Shift, ShiftAssignment
from app.models.swap import SwapRequest
from app.models.user import User
from app.schemas.swaps import SwapCreateRequest, SwapRequestResponse, SwapShiftBrief, SwapUserBrief
from app.services.access import get_accessible_location_ids, require_location_access
from app.services.swaps import (
    accept_swap,
    approve_swap,
    cancel_swap,
    claim_open_shift,
    create_swap_request,
    get_claim_eligibility,
)

router = APIRouter(tags=["swaps"])


def _swaps_query():
    return select(SwapRequest).options(
        selectinload(SwapRequest.requester_assignment).selectinload(ShiftAssignment.user),
        selectinload(SwapRequest.requester_assignment)
        .selectinload(ShiftAssignment.shift)
        .selectinload(Shift.location),
        selectinload(SwapRequest.shift).selectinload(Shift.location),
        selectinload(SwapRequest.shift).selectinload(Shift.assignments),
        selectinload(SwapRequest.target_user),
    )


async def _serialize_swap(db: AsyncSession, swap: SwapRequest, actor: User) -> SwapRequestResponse:
    assignment = swap.requester_assignment
    shift = assignment.shift if assignment and assignment.shift else swap.shift
    requester_user = assignment.user if assignment else None

    requester = SwapUserBrief(
        id=requester_user.id if requester_user else actor.id,
        name=requester_user.name if requester_user else "Open shift",
    )

    target = None
    if swap.target_user:
        target = SwapUserBrief(id=swap.target_user.id, name=swap.target_user.name)

    is_requester = assignment is not None and assignment.user_id == actor.id

    can_claim, claim_block_reason = await get_claim_eligibility(db, swap, actor)

    return SwapRequestResponse(
        id=swap.id,
        type=swap.type,
        status=swap.status,
        expires_at=swap.expires_at,
        created_at=swap.created_at,
        requester=requester,
        target=target,
        shift=SwapShiftBrief(
            shift_id=shift.id,
            location_id=shift.location_id,
            location_name=shift.location.name if shift.location else "",
            location_timezone=shift.location.timezone if shift.location else "UTC",
            starts_at=shift.starts_at,
            ends_at=shift.ends_at,
            required_skill=shift.required_skill.value,
        ),
        can_accept=swap.type == SwapType.swap
        and swap.status == SwapStatus.pending_counterparty
        and swap.target_user_id == actor.id,
        can_approve=swap.status == SwapStatus.pending_manager
        and actor.role in (UserRole.admin, UserRole.manager),
        can_cancel=swap.status in (SwapStatus.pending_counterparty, SwapStatus.pending_manager)
        and (is_requester or actor.role != UserRole.staff),
        can_claim=can_claim,
        claim_block_reason=claim_block_reason,
    )


async def _serialize_many(db: AsyncSession, swaps: list[SwapRequest], actor: User) -> list[SwapRequestResponse]:
    return [await _serialize_swap(db, s, actor) for s in swaps]


@router.get("/swap-requests", response_model=list[SwapRequestResponse])
async def list_swap_requests(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = _swaps_query()
    if user.role == UserRole.staff:
        stmt = stmt.where(
            or_(
                SwapRequest.requester_assignment.has(ShiftAssignment.user_id == user.id),
                SwapRequest.target_user_id == user.id,
                (SwapRequest.type == SwapType.drop) & (SwapRequest.status == SwapStatus.approved),
            ),
        )
    else:
        allowed = await get_accessible_location_ids(user, db)
        stmt = stmt.join(Shift, SwapRequest.shift_id == Shift.id)
        if allowed is not None:
            stmt = stmt.where(Shift.location_id.in_(allowed) if allowed else False)

    result = await db.execute(stmt.order_by(SwapRequest.created_at.desc()))
    swaps = result.scalars().unique().all()
    return await _serialize_many(db, swaps, user)


@router.get("/open-shifts", response_model=list[SwapRequestResponse])
async def list_open_shifts(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = _swaps_query().where(
        SwapRequest.type == SwapType.drop,
        SwapRequest.status == SwapStatus.approved,
    )
    if user.role != UserRole.staff:
        allowed = await get_accessible_location_ids(user, db)
        stmt = stmt.join(Shift, SwapRequest.shift_id == Shift.id)
        if allowed is not None:
            stmt = stmt.where(Shift.location_id.in_(allowed) if allowed else False)

    result = await db.execute(stmt.order_by(SwapRequest.created_at.desc()))
    swaps = result.scalars().unique().all()
    return await _serialize_many(db, swaps, user)


@router.post("/swap-requests", response_model=SwapRequestResponse)
async def post_swap_request(
    body: SwapCreateRequest,
    user: User = Depends(require_roles(UserRole.staff)),
    db: AsyncSession = Depends(get_db),
):
    swap = await create_swap_request(
        db,
        actor=user,
        assignment_id=body.assignment_id,
        swap_type=body.type,
        target_user_id=body.target_user_id,
        counterpart_assignment_id=body.counterpart_assignment_id,
    )
    await db.commit()
    swap = (await db.execute(_swaps_query().where(SwapRequest.id == swap.id))).scalar_one()
    return await _serialize_swap(db, swap, user)


@router.post("/swap-requests/{swap_id}/accept", response_model=SwapRequestResponse)
async def post_accept(
    swap_id: UUID,
    user: User = Depends(require_roles(UserRole.staff)),
    db: AsyncSession = Depends(get_db),
):
    swap = await accept_swap(db, swap_id, user)
    await db.commit()
    swap = (await db.execute(_swaps_query().where(SwapRequest.id == swap.id))).scalar_one()
    return await _serialize_swap(db, swap, user)


@router.post("/swap-requests/{swap_id}/approve", response_model=SwapRequestResponse)
async def post_approve(
    swap_id: UUID,
    user: User = Depends(require_roles(UserRole.admin, UserRole.manager)),
    db: AsyncSession = Depends(get_db),
):
    swap = await _get_swap(db, swap_id)
    await require_location_access(swap.shift.location_id, user, db)
    swap = await approve_swap(db, swap_id, user)
    await db.commit()
    swap = (await db.execute(_swaps_query().where(SwapRequest.id == swap.id))).scalar_one()
    return await _serialize_swap(db, swap, user)


@router.post("/swap-requests/{swap_id}/cancel", response_model=SwapRequestResponse)
async def post_cancel(
    swap_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    swap = await cancel_swap(db, swap_id, user)
    await db.commit()
    swap = (await db.execute(_swaps_query().where(SwapRequest.id == swap.id))).scalar_one()
    return await _serialize_swap(db, swap, user)


@router.post("/swap-requests/{swap_id}/claim")
async def post_claim(
    swap_id: UUID,
    user: User = Depends(require_roles(UserRole.staff)),
    db: AsyncSession = Depends(get_db),
):
    assignment = await claim_open_shift(db, swap_id, user)
    await db.commit()
    return {"assignment_id": str(assignment.id), "shift_id": str(assignment.shift_id)}


async def _get_swap(db: AsyncSession, swap_id: UUID) -> SwapRequest:
    result = await db.execute(_swaps_query().where(SwapRequest.id == swap_id))
    swap = result.scalar_one_or_none()
    if not swap:
        raise HTTPException(status_code=404, detail="Swap request not found")
    return swap

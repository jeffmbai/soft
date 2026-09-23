from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import AssignmentStatus, SwapStatus, SwapType, UserRole
from app.models.shift import Shift, ShiftAssignment
from app.models.swap import SwapRequest
from app.models.user import User
from app.services.audit import log_change
from app.services.concurrency import count_shift_assignments, lock_shift
from app.services.constraints import validate_assignment
from app.services.notifications import notify_location_managers, notify_user


async def _load_assignment(db: AsyncSession, assignment_id: UUID) -> ShiftAssignment:
    result = await db.execute(
        select(ShiftAssignment)
        .where(ShiftAssignment.id == assignment_id)
        .options(
            selectinload(ShiftAssignment.shift).selectinload(Shift.location),
            selectinload(ShiftAssignment.user),
        ),
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return assignment


async def cancel_swaps_for_shift(db: AsyncSession, shift_id: UUID, actor_id: UUID | None) -> int:
    result = await db.execute(
        select(SwapRequest).where(
            SwapRequest.shift_id == shift_id,
            SwapRequest.status.in_([SwapStatus.pending_counterparty, SwapStatus.pending_manager]),
        ),
    )
    swaps = result.scalars().all()
    for swap in swaps:
        swap.status = SwapStatus.superseded
        if not swap.requester_assignment_id:
            continue
        assignment = await db.get(ShiftAssignment, swap.requester_assignment_id)
        if assignment and assignment.status == AssignmentStatus.pending_swap:
            assignment.status = AssignmentStatus.assigned
        await log_change(
            db,
            entity_type="swap_request",
            entity_id=swap.id,
            actor_id=actor_id,
            before={"status": "pending"},
            after={"status": SwapStatus.superseded.value, "reason": "shift_edited"},
        )
    return len(swaps)


async def create_swap_request(
    db: AsyncSession,
    *,
    actor: User,
    assignment_id: UUID,
    swap_type: SwapType,
    target_user_id: UUID | None,
    counterpart_assignment_id: UUID | None,
) -> SwapRequest:
    assignment = await _load_assignment(db, assignment_id)
    if assignment.user_id != actor.id and actor.role == UserRole.staff:
        raise HTTPException(status_code=403, detail="Not your assignment")

    shift = assignment.shift
    if shift.starts_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Cannot swap or drop a past shift")

    pending = await db.execute(
        select(SwapRequest).where(
            SwapRequest.requester_assignment_id == assignment_id,
            SwapRequest.status.in_([SwapStatus.pending_counterparty, SwapStatus.pending_manager]),
        ),
    )
    if pending.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A pending request already exists for this assignment")

    expires_at = shift.starts_at - timedelta(hours=24)

    if swap_type == SwapType.drop:
        status = SwapStatus.pending_manager
        target_user_id = None
        counterpart_assignment_id = None
    else:
        if not target_user_id:
            raise HTTPException(status_code=400, detail="target_user_id required for swap")
        status = SwapStatus.pending_counterparty

    assignment.status = AssignmentStatus.pending_swap
    swap = SwapRequest(
        type=swap_type,
        shift_id=shift.id,
        requester_assignment_id=assignment_id,
        target_user_id=target_user_id,
        counterpart_assignment_id=counterpart_assignment_id,
        status=status,
        expires_at=expires_at,
    )
    db.add(swap)
    await db.flush()

    await log_change(
        db,
        entity_type="swap_request",
        entity_id=swap.id,
        actor_id=actor.id,
        before=None,
        after={"type": swap_type.value, "status": status.value},
    )

    if target_user_id:
        await notify_user(
            db,
            user_id=target_user_id,
            type="swap_request",
            title="Shift swap request",
            body=f"{actor.name} requested a shift swap with you.",
            payload={"swap_id": str(swap.id)},
        )

    if swap_type == SwapType.drop:
        await notify_user(
            db,
            user_id=actor.id,
            type="drop_request",
            title="Drop submitted",
            body="Your drop request is awaiting manager approval.",
            payload={"swap_id": str(swap.id)},
        )
        await notify_location_managers(
            db,
            location_id=shift.location_id,
            type="approval_required",
            title="Drop awaiting approval",
            body=f"{actor.name} requested to drop a shift at {shift.location.name}.",
            payload={"swap_id": str(swap.id), "action": "approve"},
        )

    return swap


async def accept_swap(db: AsyncSession, swap_id: UUID, actor: User) -> SwapRequest:
    swap = await _get_swap(db, swap_id)
    if swap.type != SwapType.swap:
        raise HTTPException(status_code=400, detail="Only swap requests can be accepted")
    if swap.status != SwapStatus.pending_counterparty:
        raise HTTPException(status_code=400, detail="Swap is not awaiting counterparty")
    if swap.target_user_id != actor.id:
        raise HTTPException(status_code=403, detail="Not the target of this swap")

    swap.status = SwapStatus.pending_manager
    shift = swap.requester_assignment.shift
    await notify_user(
        db,
        user_id=swap.requester_assignment.user_id,
        type="swap_accepted",
        title="Swap accepted",
        body=f"{actor.name} accepted your swap request. Awaiting manager approval.",
        payload={"swap_id": str(swap.id)},
    )
    await notify_location_managers(
        db,
        location_id=shift.location_id,
        type="approval_required",
        title="Swap awaiting approval",
        body=f"{swap.requester_assignment.user.name} and {actor.name} need manager approval for a swap.",
        payload={"swap_id": str(swap.id), "action": "approve"},
    )
    return swap


async def approve_swap(db: AsyncSession, swap_id: UUID, actor: User) -> SwapRequest:
    swap = await _get_swap_for_update(db, swap_id)
    if swap.status != SwapStatus.pending_manager:
        raise HTTPException(status_code=400, detail="Swap is not awaiting manager approval")

    assignment = swap.requester_assignment
    shift = assignment.shift

    if swap.type == SwapType.drop:
        requester_id = assignment.user_id
        await lock_shift(db, shift.id)
        await db.delete(assignment)
        swap.requester_assignment_id = None
        swap.status = SwapStatus.approved
        swap.manager_approved_at = datetime.now(timezone.utc)
        await notify_user(
            db,
            user_id=requester_id,
            type="drop_approved",
            title="Drop approved",
            body="Your shift is now in the open pool for others to claim.",
            payload={"swap_id": str(swap.id), "shift_id": str(shift.id)},
        )
    elif swap.type == SwapType.swap:
        if swap.counterpart_assignment_id:
            counterpart = await _load_assignment(db, swap.counterpart_assignment_id)
            if counterpart.user_id != swap.target_user_id:
                raise HTTPException(status_code=400, detail="Counterpart assignment mismatch")
            requester_id = assignment.user_id
            assignment.user_id = counterpart.user_id
            counterpart.user_id = requester_id
            assignment.status = AssignmentStatus.assigned
            counterpart.status = AssignmentStatus.assigned
        elif swap.target_user_id:
            result = await validate_assignment(
                db,
                shift=shift,
                location=shift.location,
                user_id=swap.target_user_id,
                actor_is_admin=actor.role == UserRole.admin,
            )
            if not result.valid:
                raise HTTPException(status_code=409, detail="Target cannot take this shift")
            assignment.user_id = swap.target_user_id
            assignment.status = AssignmentStatus.assigned
        swap.status = SwapStatus.approved
        swap.manager_approved_at = datetime.now(timezone.utc)
        for uid in {assignment.user_id, swap.target_user_id}:
            if uid:
                await notify_user(
                    db,
                    user_id=uid,
                    type="swap_approved",
                    title="Swap approved",
                    body="Your manager approved the shift swap.",
                    payload={"swap_id": str(swap.id)},
                )
    else:
        raise HTTPException(status_code=400, detail="Unknown swap type")

    await log_change(
        db,
        entity_type="swap_request",
        entity_id=swap.id,
        actor_id=actor.id,
        before={"status": SwapStatus.pending_manager.value},
        after={"status": SwapStatus.approved.value},
    )
    return swap


async def cancel_swap(db: AsyncSession, swap_id: UUID, actor: User) -> SwapRequest:
    swap = await _get_swap(db, swap_id)
    if swap.status not in (SwapStatus.pending_counterparty, SwapStatus.pending_manager):
        raise HTTPException(status_code=400, detail="Cannot cancel this request")

    assignment = swap.requester_assignment
    if assignment is None:
        raise HTTPException(status_code=400, detail="Cannot cancel this request")
    if actor.role == UserRole.staff and assignment.user_id != actor.id:
        raise HTTPException(status_code=403, detail="Not your request")

    swap.status = SwapStatus.cancelled
    assignment.status = AssignmentStatus.assigned
    await log_change(
        db,
        entity_type="swap_request",
        entity_id=swap.id,
        actor_id=actor.id,
        before={"status": "pending"},
        after={"status": SwapStatus.cancelled.value},
    )
    return swap


async def get_claim_eligibility(
    db: AsyncSession,
    swap: SwapRequest,
    actor: User,
) -> tuple[bool, str | None]:
    if actor.role != UserRole.staff:
        return False, "Only staff can claim open shifts"
    if swap.type != SwapType.drop or swap.status != SwapStatus.approved:
        return False, None

    shift_obj = swap.shift
    if shift_obj is None:
        result = await db.execute(
            select(Shift)
            .where(Shift.id == swap.shift_id)
            .options(selectinload(Shift.location), selectinload(Shift.assignments)),
        )
        shift_obj = result.scalar_one()

    if shift_obj.starts_at <= datetime.now(timezone.utc):
        return False, "Shift is in the past"

    if len(shift_obj.assignments) >= shift_obj.headcount:
        return False, "Shift roster is full — waiting for manager to release the slot"

    result = await validate_assignment(
        db,
        shift=shift_obj,
        location=shift_obj.location,
        user_id=actor.id,
        actor_is_admin=False,
    )
    if not result.valid:
        blocking = [v for v in result.violations if v.severity.value == "error"]
        return False, blocking[0].message if blocking else "You are not eligible for this shift"

    return True, None


async def claim_open_shift(db: AsyncSession, swap_id: UUID, actor: User) -> ShiftAssignment:
    swap = await _get_swap_for_update(db, swap_id)
    if swap.type != SwapType.drop:
        raise HTTPException(status_code=400, detail="Shift is not available to claim")
    if swap.status != SwapStatus.approved:
        raise HTTPException(status_code=409, detail="This shift was just claimed by someone else")

    shift_obj = await lock_shift(db, swap.shift_id)

    if shift_obj.starts_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Shift is in the past")

    assignment_count = await count_shift_assignments(db, shift_obj.id)
    if assignment_count >= shift_obj.headcount:
        raise HTTPException(status_code=409, detail="Shift is already full")

    result = await validate_assignment(
        db,
        shift=shift_obj,
        location=shift_obj.location,
        user_id=actor.id,
        actor_is_admin=False,
    )
    if not result.valid:
        blocking = [v for v in result.violations if v.severity.value == "error"]
        raise HTTPException(status_code=409, detail=blocking[0].message if blocking else "Cannot claim shift")

    new_assignment = ShiftAssignment(shift_id=shift_obj.id, user_id=actor.id)
    db.add(new_assignment)
    swap.status = SwapStatus.cancelled  # claimed / closed

    await notify_user(
        db,
        user_id=actor.id,
        type="shift_claimed",
        title="Shift claimed",
        body=f"You claimed an open shift at {shift_obj.location.name}.",
        payload={"shift_id": str(shift_obj.id)},
    )

    await log_change(
        db,
        entity_type="swap_request",
        entity_id=swap.id,
        actor_id=actor.id,
        before={"status": SwapStatus.approved.value},
        after={"status": "claimed", "user_id": str(actor.id)},
    )
    return new_assignment


def _swap_load_options():
    return (
        selectinload(SwapRequest.requester_assignment).selectinload(ShiftAssignment.user),
        selectinload(SwapRequest.requester_assignment)
        .selectinload(ShiftAssignment.shift)
        .selectinload(Shift.location),
        selectinload(SwapRequest.shift).selectinload(Shift.location),
        selectinload(SwapRequest.target_user),
    )


async def _get_swap(db: AsyncSession, swap_id: UUID) -> SwapRequest:
    result = await db.execute(
        select(SwapRequest).where(SwapRequest.id == swap_id).options(*_swap_load_options()),
    )
    swap = result.scalar_one_or_none()
    if not swap:
        raise HTTPException(status_code=404, detail="Swap request not found")
    return swap


async def _get_swap_for_update(db: AsyncSession, swap_id: UUID) -> SwapRequest:
    result = await db.execute(
        select(SwapRequest)
        .where(SwapRequest.id == swap_id)
        .options(*_swap_load_options())
        .with_for_update(),
    )
    swap = result.scalar_one_or_none()
    if not swap:
        raise HTTPException(status_code=404, detail="Swap request not found")
    return swap

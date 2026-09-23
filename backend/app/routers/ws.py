import asyncio
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.database import async_session
from app.routers.duty import authenticate_ws_token
from app.services.redis_bus import subscribe_duty_updates
from app.services.ws_manager import duty_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

_listener_task: asyncio.Task | None = None


async def _redis_listener() -> None:
    while True:
        try:
            async for _message in subscribe_duty_updates():
                await duty_manager.broadcast_refresh()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Redis duty listener failed; retrying in 2s")
            await asyncio.sleep(2)


def start_redis_listener() -> asyncio.Task:
    global _listener_task
    if _listener_task is None or _listener_task.done():
        _listener_task = asyncio.create_task(_redis_listener())
    return _listener_task


async def stop_redis_listener() -> None:
    global _listener_task
    if _listener_task and not _listener_task.done():
        _listener_task.cancel()
        try:
            await _listener_task
        except asyncio.CancelledError:
            pass
    _listener_task = None


@router.websocket("/ws/duty")
async def duty_websocket(websocket: WebSocket, token: str = Query(...)):
    try:
        async with async_session() as db:
            user = await authenticate_ws_token(token, db)
    except ValueError:
        await websocket.close(code=4401)
        return

    connection = await duty_manager.connect(websocket, user.id)
    try:
        await duty_manager.send_snapshot(connection)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await duty_manager.disconnect(websocket)

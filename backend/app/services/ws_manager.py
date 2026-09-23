import asyncio
import logging
from dataclasses import dataclass, field
from uuid import UUID

from fastapi import WebSocket

from app.database import async_session
from app.models.user import User
from app.services.duty import get_floor_snapshot

logger = logging.getLogger(__name__)


@dataclass
class DutyConnection:
    websocket: WebSocket
    user_id: UUID


@dataclass
class DutyConnectionManager:
    connections: list[DutyConnection] = field(default_factory=list)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    async def connect(self, websocket: WebSocket, user_id: UUID) -> DutyConnection:
        await websocket.accept()
        connection = DutyConnection(websocket=websocket, user_id=user_id)
        async with self._lock:
            self.connections.append(connection)
        return connection

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self.connections = [c for c in self.connections if c.websocket is not websocket]

    async def send_snapshot(self, connection: DutyConnection) -> None:
        async with async_session() as db:
            user = await db.get(User, connection.user_id)
            if not user:
                return
            snapshot = await get_floor_snapshot(db, user)
        await connection.websocket.send_json({"type": "snapshot", "data": snapshot.model_dump(mode="json")})

    async def broadcast_refresh(self) -> None:
        async with self._lock:
            targets = list(self.connections)
        for connection in targets:
            try:
                await self.send_snapshot(connection)
            except Exception:
                logger.exception("Failed to push duty snapshot")
                await self.disconnect(connection.websocket)


duty_manager = DutyConnectionManager()

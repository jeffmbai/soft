import asyncio
import json
import logging
from collections.abc import AsyncIterator
from typing import Any

import redis.asyncio as redis

from app.config import settings

logger = logging.getLogger(__name__)

DUTY_CHANNEL = "duty:updates"

_client: redis.Redis | None = None
_listener_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.from_url(settings.redis_url, decode_responses=True)
    return _client


def get_listener_redis() -> redis.Redis:
    global _listener_client
    if _listener_client is None:
        _listener_client = redis.from_url(settings.redis_url, decode_responses=True)
    return _listener_client


async def publish_duty_update(payload: dict[str, Any] | None = None) -> None:
    message = json.dumps(payload or {"type": "refresh"})
    try:
        await get_redis().publish(DUTY_CHANNEL, message)
    except redis.RedisError:
        logger.exception("Failed to publish duty update to Redis")


async def subscribe_duty_updates() -> AsyncIterator[dict[str, Any]]:
    pubsub = get_listener_redis().pubsub()
    await pubsub.subscribe(DUTY_CHANNEL)
    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message is None:
                await asyncio.sleep(0.05)
                continue
            if message.get("type") != "message":
                continue
            data = message.get("data")
            if not data:
                continue
            try:
                yield json.loads(data)
            except json.JSONDecodeError:
                yield {"type": "refresh"}
    finally:
        await pubsub.unsubscribe(DUTY_CHANNEL)
        await pubsub.close()


async def close_redis() -> None:
    global _client, _listener_client
    for client in (_client, _listener_client):
        if client is not None:
            await client.aclose()
    _client = None
    _listener_client = None

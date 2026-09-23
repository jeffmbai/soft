from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, availability, duty, locations, notifications, scheduling, staff, swaps, ws
from app.services.redis_bus import close_redis
from app.routers.ws import start_redis_listener, stop_redis_listener


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_redis_listener()
    yield
    await stop_redis_listener()
    await close_redis()


app = FastAPI(title="ShiftSync API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(locations.router, prefix="/api")
app.include_router(staff.router, prefix="/api")
app.include_router(scheduling.router, prefix="/api")
app.include_router(availability.router, prefix="/api")
app.include_router(swaps.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(duty.router, prefix="/api")
app.include_router(ws.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}

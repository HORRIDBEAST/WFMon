from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from config           import get_settings
from services.cache   import CacheService
from routers          import timeseries, metrics

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: connect cache. Shutdown: disconnect cleanly."""
    app.state.cache = CacheService(settings.redis_url)
    await app.state.cache.connect()
    logger.info("Redis cache connected.")
    yield
    await app.state.cache.disconnect()
    logger.info("Redis cache disconnected.")


app = FastAPI(
    title="Wind Forecast Monitor API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(timeseries.router)
app.include_router(metrics.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
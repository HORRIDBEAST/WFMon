import redis.asyncio as aioredis
import json
import hashlib
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


class CacheService:
    def __init__(self, redis_url: str):
        self._redis_url = redis_url
        self._client: Optional[aioredis.Redis] = None

    async def connect(self):
        self._client = aioredis.from_url(self._redis_url, decode_responses=True)

    async def disconnect(self):
        if self._client:
            await self._client.aclose()

    def _make_key(self, start: str, end: str, horizon: float) -> str:
        raw = f"{start}|{end}|{horizon:.2f}"
        digest = hashlib.md5(raw.encode()).hexdigest()
        return f"wf:ts:{digest}"

    async def get(self, start: str, end: str, horizon: float) -> Optional[Any]:
        if not self._client:
            return None
        try:
            val = await self._client.get(self._make_key(start, end, horizon))
            return json.loads(val) if val else None
        except Exception as exc:
            # Cache failure is non-fatal — log and continue
            logger.warning("Cache GET failed: %s", exc)
            return None

    async def set(
        self, start: str, end: str, horizon: float, data: Any, ttl: int = 300
    ) -> None:
        if not self._client:
            return
        try:
            await self._client.setex(
                self._make_key(start, end, horizon),
                ttl,
                json.dumps(data),
            )
        except Exception as exc:
            logger.warning("Cache SET failed: %s", exc)
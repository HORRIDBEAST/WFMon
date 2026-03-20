from fastapi import APIRouter, Depends, HTTPException, Query, Request
from datetime import datetime
import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.models.schemas import MetricsResponse
from backend.services.fetcher  import fetch_actuals, fetch_forecasts
from backend.services.aligner  import (
    build_actuals_df, build_forecasts_df, apply_horizon_filter,
)
from backend.services.errors   import compute_metrics
from backend.services.cache    import CacheService
from backend.config            import get_settings

router = APIRouter(prefix="/metrics", tags=["metrics"])
logger = logging.getLogger(__name__)


def get_cache(request: Request) -> CacheService:
    return request.app.state.cache


@router.get("", response_model=MetricsResponse)
async def get_metrics(
    start_time: datetime = Query(...),
    end_time:   datetime = Query(...),
    horizon:    float    = Query(4.0, ge=0, le=48),
    cache:      CacheService = Depends(get_cache),
    settings = Depends(get_settings),
):
    """
    Return MAE, RMSE, and P99 absolute error for the given window and horizon.
    """
    if end_time <= start_time:
        raise HTTPException(400, "end_time must be after start_time")

    cache_key = f"metrics|{start_time.isoformat()}|{end_time.isoformat()}|{horizon}"
    cached = await cache.get(str(start_time), str(end_time), horizon)

    try:
        actuals_raw, forecasts_raw = await asyncio.gather(
            fetch_actuals(start_time, end_time, settings.elexon_timeout),
            fetch_forecasts(start_time, end_time, horizon, settings.elexon_timeout),
        )
    except Exception as exc:
        raise HTTPException(502, f"Upstream fetch failed: {exc}")

    actuals_df   = build_actuals_df(actuals_raw)
    forecasts_df = build_forecasts_df(forecasts_raw)
    aligned_df   = apply_horizon_filter(actuals_df, forecasts_df, horizon)

    return compute_metrics(aligned_df)
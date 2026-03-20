from fastapi import APIRouter, Depends, HTTPException, Query, Request
from datetime import datetime
import asyncio
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.models.schemas import TimeseriesResponse
from backend.services.fetcher  import fetch_actuals, fetch_forecasts
from backend.services.aligner  import (
    build_actuals_df, build_forecasts_df,
    apply_horizon_filter, to_response_lists,
)
from backend.services.cache    import CacheService
from backend.config            import get_settings

router = APIRouter(prefix="/timeseries", tags=["timeseries"])
logger = logging.getLogger(__name__)


def get_cache(request: Request) -> CacheService:
    # Always read cache from the live app instance handling this request.
    return request.app.state.cache


@router.get("", response_model=TimeseriesResponse)
async def get_timeseries(
    start_time: datetime = Query(..., description="ISO-8601 start datetime (UTC)"),
    end_time:   datetime = Query(..., description="ISO-8601 end datetime (UTC)"),
    horizon:    float    = Query(4.0, ge=0, le=48, description="Forecast horizon in hours"),
    cache:      CacheService = Depends(get_cache),
    settings = Depends(get_settings),
):
    """
    Return aligned actual and forecast time series for the given window and horizon.
    Forecast data gaps are silently dropped (not null-padded).
    """
    if end_time <= start_time:
        raise HTTPException(400, "end_time must be after start_time")

    start_iso = start_time.isoformat()
    end_iso   = end_time.isoformat()

    # Check cache first
    cached = await cache.get(start_iso, end_iso, horizon)
    if cached:
        logger.info("Cache hit for %s → %s h=%.1f", start_iso, end_iso, horizon)
        return cached

    try:
        # Fetch actuals and forecasts concurrently
        actuals_raw, forecasts_raw = await asyncio.gather(
            fetch_actuals(start_time, end_time, settings.elexon_timeout),
            fetch_forecasts(start_time, end_time, horizon, settings.elexon_timeout),
        )
    except Exception as exc:
        logger.error("Upstream fetch failed: %s", exc)
        raise HTTPException(502, f"Failed to fetch data from Elexon: {exc}")

    actuals_df   = build_actuals_df(actuals_raw)
    forecasts_df = build_forecasts_df(forecasts_raw)
    aligned_df   = apply_horizon_filter(actuals_df, forecasts_df, horizon)
    response     = to_response_lists(aligned_df)

    await cache.set(start_iso, end_iso, horizon, response, ttl=settings.cache_ttl)
    return response
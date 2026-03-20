import httpx
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)

FUELHH_URL  = "https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream"
WINDFOR_URL = "https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream"

# Elexon uses NDJSON (newline-delimited JSON) for stream endpoints.
# We parse each line independently and collect valid records.

def _parse_ndjson(raw: str) -> list[dict]:
    """Parse NDJSON/JSON payloads and normalise to a flat list of dict records."""
    import json
    records = []
    for line in raw.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            parsed = json.loads(line)

            if isinstance(parsed, list):
                records.extend(item for item in parsed if isinstance(item, dict))
            elif isinstance(parsed, dict):
                # Some APIs wrap rows in a container, e.g. {"data": [...]}.
                if isinstance(parsed.get("data"), list):
                    records.extend(item for item in parsed["data"] if isinstance(item, dict))
                else:
                    records.append(parsed)
        except json.JSONDecodeError:
            logger.warning("Skipping unparseable line: %s", line[:80])
    return records


async def fetch_actuals(
    start: datetime,
    end: datetime,
    timeout: int = 30,
) -> list[dict[str, Any]]:
    """
    Fetch half-hourly actual WIND generation from the FUELHH stream endpoint.
    Returns list of dicts with keys: startTime, generation.
    """
    params = {
        "settlementDateFrom": start.strftime("%Y-%m-%d"),
        "settlementDateTo":   end.strftime("%Y-%m-%d"),
        "fuelType":           "WIND",
        "format":             "json",
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        logger.info("Fetching actuals: %s → %s", start.date(), end.date())
        resp = await client.get(FUELHH_URL, params=params)
        resp.raise_for_status()

    records = _parse_ndjson(resp.text)
    # Normalise: keep only relevant fields, filter to WIND just in case
    return [
        {
            "startTime":  r["startTime"],
            "generation": float(r["generation"]),
        }
        for r in records
        if r.get("fuelType", "WIND") == "WIND" and r.get("generation") is not None
    ]


async def fetch_forecasts(
    start: datetime,
    end: datetime,
    horizon_hours: float = 48,
    timeout: int = 30,
) -> list[dict[str, Any]]:
    """
    Fetch wind generation forecasts from the WINDFOR stream endpoint.

    We extend the publishDateTimeFrom window backwards by horizon_hours so that
    forecasts published well before `start` (but valid for times within range)
    are included — essential for large horizon values.
    """
    # Pull publish window back by max horizon to capture early forecasts
    publish_from = start - timedelta(hours=max(horizon_hours, 48))

    params = {
        "publishDateTimeFrom": publish_from.replace(tzinfo=timezone.utc).isoformat(),
        "publishDateTimeTo":   end.replace(tzinfo=timezone.utc).isoformat(),
        "format":              "json",
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        logger.info("Fetching forecasts: publish window %s → %s", publish_from, end)
        resp = await client.get(WINDFOR_URL, params=params)
        resp.raise_for_status()

    records = _parse_ndjson(resp.text)
    return [
        {
            "startTime":   r["startTime"],
            "publishTime": r["publishTime"],
            "generation":  float(r["generation"]),
        }
        for r in records
        if r.get("generation") is not None
    ]
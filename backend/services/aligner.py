import pandas as pd
import numpy as np
import logging
from datetime import timedelta

logger = logging.getLogger(__name__)

MIN_DATE = pd.Timestamp("2025-01-01", tz="UTC")


def build_actuals_df(records: list[dict]) -> pd.DataFrame:
    """Parse actuals list into a clean, UTC-indexed DataFrame."""
    df = pd.DataFrame(records)
    if df.empty:
        return df
    df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
    df = df[df["startTime"] >= MIN_DATE]
    df = df.sort_values("startTime").drop_duplicates("startTime")
    df = df.rename(columns={"generation": "actual"})
    return df.set_index("startTime")


def build_forecasts_df(records: list[dict]) -> pd.DataFrame:
    """Parse forecasts list into a clean, UTC-indexed DataFrame."""
    df = pd.DataFrame(records)
    if df.empty:
        return df
    df["startTime"]   = pd.to_datetime(df["startTime"],   utc=True)
    df["publishTime"] = pd.to_datetime(df["publishTime"], utc=True)
    df = df[df["startTime"] >= MIN_DATE]
    df = df.sort_values(["startTime", "publishTime"])
    return df


def apply_horizon_filter(
    actuals_df: pd.DataFrame,
    forecasts_df: pd.DataFrame,
    horizon_hours: float,
) -> pd.DataFrame:
    """
    Core alignment logic:
      For each target time T in actuals,
        find the latest forecast where publishTime <= T - horizon.

    Returns a DataFrame with columns: timestamp, actual, forecast.
    Rows where no valid forecast exists are dropped entirely (not null-filled).
    """
    if actuals_df.empty or forecasts_df.empty:
        return pd.DataFrame(columns=["timestamp", "actual", "forecast"])

    horizon = timedelta(hours=horizon_hours)
    rows = []

    for target_time, actual_row in actuals_df.iterrows():
        cutoff = target_time - horizon

        # Forecasts for this exact target time, published before the cutoff
        candidates = forecasts_df[
            (forecasts_df["startTime"] == target_time) &
            (forecasts_df["publishTime"] <= cutoff)
        ]

        if candidates.empty:
            # No valid forecast for this target under the given horizon — skip
            logger.debug("No forecast for %s at horizon %.1fh", target_time, horizon_hours)
            continue

        # Pick the most recently published valid forecast
        best = candidates.loc[candidates["publishTime"].idxmax()]

        rows.append({
            "timestamp": target_time,
            "actual":    float(actual_row["actual"]),
            "forecast":  float(best["generation"]),
        })

    result = pd.DataFrame(rows)
    if not result.empty:
        result = result.sort_values("timestamp").reset_index(drop=True)

    logger.info(
        "Aligned %d target times (of %d actuals, horizon=%.1fh)",
        len(result), len(actuals_df), horizon_hours
    )
    return result


def to_response_lists(aligned_df: pd.DataFrame) -> dict:
    """Serialise aligned DataFrame to the JSON response shape."""
    if aligned_df.empty:
        return {"timestamps": [], "actual": [], "forecast": []}

    return {
        "timestamps": [t.isoformat() for t in aligned_df["timestamp"]],
        "actual":     aligned_df["actual"].round(2).tolist(),
        "forecast":   aligned_df["forecast"].round(2).tolist(),
    }
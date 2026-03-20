import numpy as np
import pandas as pd

def compute_metrics(aligned_df: pd.DataFrame) -> dict:
    """
    Compute error statistics on aligned actual vs forecast pairs.

    aligned_df must have columns: actual, forecast.
    Returns: mae, rmse, p99, n.
    """
    if aligned_df.empty or len(aligned_df) < 2:
        return {"mae": 0.0, "rmse": 0.0, "p99": 0.0, "n": 0}

    errors  = (aligned_df["actual"] - aligned_df["forecast"]).abs().values
    sq_err  = (aligned_df["actual"] - aligned_df["forecast"]).values ** 2

    return {
        "mae":  round(float(np.mean(errors)),          2),
        "rmse": round(float(np.sqrt(np.mean(sq_err))), 2),
        "p99":  round(float(np.percentile(errors, 99)),2),
        "n":    len(aligned_df),
    }
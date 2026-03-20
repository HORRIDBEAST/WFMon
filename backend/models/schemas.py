from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional

class TimeseriesRequest(BaseModel):
    start_time: datetime
    end_time: datetime
    horizon: float  # hours, 0–48

    @field_validator("horizon")
    @classmethod
    def validate_horizon(cls, v):
        if not 0 <= v <= 48:
            raise ValueError("horizon must be between 0 and 48 hours")
        return v

    @field_validator("end_time")
    @classmethod
    def validate_range(cls, v, info):
        if "start_time" in info.data and v <= info.data["start_time"]:
            raise ValueError("end_time must be after start_time")
        return v

class TimeseriesResponse(BaseModel):
    timestamps: list[str]
    actual: list[Optional[float]]
    forecast: list[Optional[float]]

class MetricsResponse(BaseModel):
    mae: float
    rmse: float
    p99: float
    n: int

class ErrorResponse(BaseModel):
    detail: str
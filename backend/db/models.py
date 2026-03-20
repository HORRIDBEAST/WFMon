from sqlalchemy import Column, String, Float, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID
import uuid

try:
    from backend.db.database import Base
except ModuleNotFoundError:
    from db.database import Base

class ActualGeneration(Base):
    __tablename__ = "actual_generation"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    start_time = Column(DateTime(timezone=True), nullable=False)
    generation = Column(Float, nullable=False)
    fuel_type  = Column(String, default="WIND")

    __table_args__ = (
        Index("ix_actual_start_time", "start_time"),
    )

class ForecastGeneration(Base):
    __tablename__ = "forecast_generation"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    start_time   = Column(DateTime(timezone=True), nullable=False)
    publish_time = Column(DateTime(timezone=True), nullable=False)
    generation   = Column(Float, nullable=False)

    __table_args__ = (
        Index("ix_forecast_start_time",   "start_time"),
        Index("ix_forecast_publish_time", "publish_time"),
    )
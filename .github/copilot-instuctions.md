# GitHub Copilot Context — Wind Forecast Monitor

You are assisting development of a **production-grade wind power forecast monitoring system**
for the UK national grid. This document is the authoritative reference for all code suggestions.
Always prefer completions that are consistent with the patterns, naming conventions, types,
and architectural decisions described here.

---

## 1. Project Overview

| Attribute        | Detail |
|------------------|--------|
| **Purpose**      | Compare actual vs forecasted UK wind power generation with configurable forecast horizon |
| **Data source**  | Elexon BMRS API (FUELHH for actuals, WINDFOR for forecasts) |
| **Time resolution** | 30-minute half-hourly settlement periods |
| **Data scope**   | 2025-01-01 onwards, forecast horizon 0–48 hours |
| **Deployment**   | Frontend → Vercel, Backend → Railway/Render |

---

## 2. Repository Structure

```
/
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── requirements.txt
│   ├── Procfile
│   ├── routers/
│   │   ├── timeseries.py
│   │   └── metrics.py
│   ├── services/
│   │   ├── fetcher.py
│   │   ├── aligner.py
│   │   ├── errors.py
│   │   └── cache.py
│   ├── models/
│   │   └── schemas.py
│   └── db/
│       ├── database.py
│       └── models.py
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── dashboard/
│   │       └── page.tsx
│   ├── components/
│   │   ├── DateRangePicker.tsx
│   │   ├── HorizonSlider.tsx
│   │   ├── ForecastChart.tsx
│   │   └── MetricsPanel.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   ├── types.ts
│   │   └── utils.ts
│   └── hooks/
│       ├── useTimeseries.ts
│       └── useMetrics.ts
└── notebooks/
    ├── 01_forecast_error_analysis.ipynb
    └── 02_wind_reliability_analysis.ipynb
```

---

## 3. Tech Stack (Exact Versions)

### Backend
| Package             | Version  | Role |
|---------------------|----------|------|
| fastapi             | 0.111.0  | Web framework |
| uvicorn[standard]   | 0.30.0   | ASGI server |
| httpx               | 0.27.0   | Async HTTP client for Elexon API |
| pandas              | 2.2.2    | Time-series alignment and aggregation |
| numpy               | 1.26.4   | Error metric computation |
| redis[asyncio]      | 5.0.4    | Caching layer |
| pydantic            | 2.7.1    | Request/response validation |
| pydantic-settings   | 2.3.0    | Env-driven config |
| sqlalchemy[asyncio] | 2.0.30   | ORM (optional persistence) |
| asyncpg             | 0.29.0   | PostgreSQL async driver |

### Frontend
| Package   | Version | Role |
|-----------|---------|------|
| next      | 14.2.3  | React framework (App Router) |
| react     | 18.3.1  | UI |
| recharts  | 2.12.7  | Chart library |
| swr       | 2.2.5   | Data fetching + caching |
| date-fns  | 3.6.0   | Date manipulation |
| tailwindcss | 3.4.4 | Styling |
| typescript | 5.4.5  | Type safety |

### Notebooks
- Python 3.11, pandas, numpy, matplotlib, seaborn, scipy, requests

---

## 4. Environment Variables

### Backend `.env`
```
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/windforecast
REDIS_URL=redis://localhost:6379
CACHE_TTL=300
ELEXON_TIMEOUT=30
CORS_ORIGINS=["http://localhost:3000","https://your-app.vercel.app"]
```

### Frontend `.env.local`
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 5. External API Contracts

### FUELHH (Actual Generation)
- **URL:** `https://api.elexon.co.uk/BMRS/api/v1/datasets/FUELHH/stream`
- **Format:** Newline-delimited JSON (NDJSON) — parse line-by-line
- **Params:** `settlementDateFrom`, `settlementDateTo`, `fuelType=WIND`, `format=json`
- **Key fields:**
  - `startTime` — ISO-8601 UTC, 30-minute resolution, the target time
  - `generation` — float, MW
  - `fuelType` — always filter to `"WIND"`

### WINDFOR (Forecast)
- **URL:** `https://api.elexon.co.uk/BMRS/api/v1/datasets/WINDFOR/stream`
- **Format:** NDJSON
- **Params:** `publishDateTimeFrom`, `publishDateTimeTo`, `format=json`
- **Key fields:**
  - `startTime` — the target time being forecast
  - `publishTime` — when this forecast was created/published
  - `generation` — float, MW

### NDJSON parsing pattern (always use this)
```python
def parse_ndjson(text: str) -> list[dict]:
    import json
    records = []
    for line in text.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            records.append(json.loads(line))
        except json.JSONDecodeError:
            pass  # silently skip malformed lines
    return records
```

---

## 6. Core Business Logic

### Horizon Filtering — THE most critical logic in the system

For a given target time `T` and forecast horizon `h` hours:
1. Compute `cutoff = T - timedelta(hours=h)`
2. Find all forecasts where `startTime == T` AND `publishTime <= cutoff`
3. Select the **latest** (max `publishTime`) among those — the most informed valid forecast
4. If no valid forecast exists: **drop this T entirely** — do NOT fill with null or zero

```python
from datetime import timedelta
import pandas as pd

def apply_horizon_filter(
    actuals_df: pd.DataFrame,    # columns: startTime (UTC-aware index), actual
    forecasts_df: pd.DataFrame,  # columns: startTime, publishTime, generation
    horizon_hours: float,
) -> pd.DataFrame:
    horizon = timedelta(hours=horizon_hours)
    rows = []
    forecast_groups = forecasts_df.groupby('startTime')

    for target_time, actual_row in actuals_df.iterrows():
        cutoff = target_time - horizon
        try:
            grp = forecast_groups.get_group(target_time)
        except KeyError:
            continue
        valid = grp[grp['publishTime'] <= cutoff]
        if valid.empty:
            continue
        best_gen = valid.loc[valid['publishTime'].idxmax(), 'generation']
        rows.append({
            'timestamp': target_time,
            'actual':    float(actual_row['actual']),
            'forecast':  float(best_gen),
        })

    result = pd.DataFrame(rows)
    if not result.empty:
        result['signed_error'] = result['forecast'] - result['actual']
        result['abs_error']    = result['signed_error'].abs()
    return result
```

### Error Metrics
```python
import numpy as np

def compute_metrics(aligned_df: pd.DataFrame) -> dict:
    # aligned_df must have columns: actual, forecast
    errors   = (aligned_df['actual'] - aligned_df['forecast']).abs().values
    sq_err   = (aligned_df['actual'] - aligned_df['forecast']).values ** 2
    return {
        'mae':  round(float(np.mean(errors)),           2),
        'rmse': round(float(np.sqrt(np.mean(sq_err))),  2),
        'p99':  round(float(np.percentile(errors, 99)), 2),
        'n':    len(aligned_df),
    }
```

### Forecast fetch window extension
When fetching forecasts, always pull `publishDateTimeFrom = start - timedelta(hours=48)`.
This ensures forecasts published well before the start of the window (needed for large horizons)
are captured.

---

## 7. Backend Architecture

### FastAPI app (`backend/main.py`)
```python
# App is created with a lifespan context manager (NOT @app.on_event)
# Redis cache is stored on app.state.cache
# CORS is configured via CORSMiddleware
# Two routers: timeseries.router, metrics.router

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.cache = CacheService(settings.redis_url)
    await app.state.cache.connect()
    yield
    await app.state.cache.disconnect()
```

### Settings (`backend/config.py`)
```python
# Always use get_settings() — it's @lru_cache decorated
from backend.config import get_settings
settings = get_settings()
```

### Cache key pattern
```python
# Cache keys are MD5 hashes of "startISO|endISO|horizon"
# Prefix: "wf:ts:" for timeseries, metrics share the same key namespace
# TTL: settings.cache_ttl (default 300 seconds)
```

### Router dependency injection pattern
```python
# Cache is injected via Depends, sourced from app.state
def get_cache() -> CacheService:
    from backend.main import app
    return app.state.cache
```

---

## 8. Pydantic Schemas

```python
# backend/models/schemas.py

class TimeseriesRequest(BaseModel):
    start_time: datetime   # UTC-aware
    end_time:   datetime   # UTC-aware
    horizon:    float      # 0.0–48.0 hours

class TimeseriesResponse(BaseModel):
    timestamps: list[str]          # ISO-8601 strings
    actual:     list[float | None]
    forecast:   list[float | None]

class MetricsResponse(BaseModel):
    mae:  float
    rmse: float
    p99:  float
    n:    int
```

---

## 9. Database Models

```python
# backend/db/models.py — SQLAlchemy 2.0 async ORM

class ActualGeneration(Base):
    __tablename__ = "actual_generation"
    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    start_time = Column(DateTime(timezone=True), nullable=False)
    generation = Column(Float, nullable=False)
    fuel_type  = Column(String, default="WIND")
    # Index on start_time

class ForecastGeneration(Base):
    __tablename__ = "forecast_generation"
    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    start_time   = Column(DateTime(timezone=True), nullable=False)
    publish_time = Column(DateTime(timezone=True), nullable=False)
    generation   = Column(Float, nullable=False)
    # Indexes on start_time and publish_time
```

---

## 10. Frontend Architecture

### Framework conventions
- **Next.js 14 App Router** — all pages in `app/` directory
- `"use client"` directive required on all interactive components
- No Redux — use local `useState` + SWR for server data
- Tailwind utility classes only — no CSS modules, no styled-components

### Data fetching pattern
```typescript
// Always use SWR hooks, never fetch directly in components
// Keys are arrays: ['timeseries', startTime, endTime, horizon]
// revalidateOnFocus: false, dedupingInterval: 30_000

import useSWR from 'swr'
import { fetchTimeseries } from '@/lib/api'
import { QueryParams, TimeseriesResponse } from '@/lib/types'

export function useTimeseries(params: QueryParams | null) {
  const key = params
    ? ['timeseries', params.startTime, params.endTime, params.horizon]
    : null
  return useSWR<TimeseriesResponse>(key, () => fetchTimeseries(params!), {
    revalidateOnFocus: false,
    dedupingInterval:  30_000,
  })
}
```

### API call pattern
```typescript
// backend query params use snake_case: start_time, end_time, horizon
// NEXT_PUBLIC_API_URL is the base — never hardcode localhost

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function buildParams(params: QueryParams): URLSearchParams {
  return new URLSearchParams({
    start_time: params.startTime,
    end_time:   params.endTime,
    horizon:    String(params.horizon),
  })
}
```

### TypeScript interfaces
```typescript
// frontend/lib/types.ts

export interface TimeseriesResponse {
  timestamps: string[]
  actual:     (number | null)[]
  forecast:   (number | null)[]
}

export interface MetricsResponse {
  mae:  number
  rmse: number
  p99:  number
  n:    number
}

export interface QueryParams {
  startTime: string   // ISO-8601
  endTime:   string   // ISO-8601
  horizon:   number   // hours, 0–48
}
```

---

## 11. Component Patterns

### ForecastChart
- Library: **Recharts** — `LineChart`, `Line`, `XAxis`, `YAxis`, `Tooltip`, `Legend`, `ReferenceLine`
- Actual generation line: `stroke="#3b82f6"` (blue), `strokeWidth={2}`
- Forecast generation line: `stroke="#22c55e"` (green), `strokeWidth={2}`
- Error overlay line: `stroke="#f59e0b"` (amber), `strokeDasharray="4 2"`, toggled by `showErrorOverlay` prop
- MAE reference line shown only when error overlay is active
- `connectNulls={false}` on all lines — gaps in data should show as breaks, not interpolated
- Y-axis values in MW, formatted with `formatMW()` helper (shows `k` suffix above 1000)
- X-axis uses `formatTimestamp()` — `dd/MM HH:mm` format

```typescript
// Chart data point shape
interface ChartPoint {
  time:     string
  actual:   number | null
  forecast: number | null
  error:    number | null  // |actual - forecast|, null if either is missing
}
```

### MetricsPanel
- 4 stat cards: MAE (blue), RMSE (purple), P99 (amber), N samples (gray)
- Values displayed in GW (divide raw MW by 1000), 2 decimal places
- Skeleton loading state with `animate-pulse`

### HorizonSlider
- `<input type="range" min={0} max={48} step={0.5}>`
- Displays current value as `{value}h` label
- `accent-blue-500` Tailwind class for thumb colour

### DateRangePicker
- Uses `<input type="datetime-local">` — convert to/from ISO-8601
- `toInputValue(iso)` strips to 16 chars: `iso.slice(0, 16)`

### Dashboard page state
```typescript
// Committed params pattern — only trigger API calls when user clicks Apply
const [startTime, setStartTime] = useState(defaultStartTime())
const [endTime,   setEndTime]   = useState(defaultEndTime())
const [horizon,   setHorizon]   = useState(4)        // default 4h
const [showError, setShowError] = useState(false)
const [params,    setParams]    = useState<QueryParams>({ ... })

// Only setParams on Apply button click — prevents over-fetching
const handleApply = () => setParams({ startTime, endTime, horizon })
```

---

## 12. Utility Functions

```typescript
// frontend/lib/utils.ts

// Format ISO timestamp for chart X-axis
export function formatTimestamp(iso: string): string {
  return format(parseISO(iso), 'dd/MM HH:mm')  // date-fns
}

// Format MW value — shows GW suffix above 1000
export function formatMW(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return `${Math.round(value)}`
}

// Default time range: last 24 hours
export function defaultStartTime(): string {
  return subDays(new Date(), 1).toISOString()
}
export function defaultEndTime(): string {
  return new Date().toISOString()
}
```

---

## 13. Notebook Conventions

### Shared setup (both notebooks)
```python
import warnings; warnings.filterwarnings('ignore')
import requests, pandas as pd, numpy as np
import matplotlib.pyplot as plt, seaborn as sns

sns.set_theme(style='whitegrid', palette='muted', font_scale=1.1)
plt.rcParams['figure.dpi'] = 120
plt.rcParams['axes.spines.top']   = False
plt.rcParams['axes.spines.right'] = False

# Colour palette (consistent across all charts)
BLUE   = '#3b82f6'
GREEN  = '#22c55e'
AMBER  = '#f59e0b'
PURPLE = '#a855f7'
CORAL  = '#ef4444'
GRAY   = '#6b7280'

# Key constants
ANALYSIS_START       = datetime(2025, 1, 1, tzinfo=timezone.utc)
INSTALLED_CAPACITY_MW = 25_000   # UK onshore + offshore wind, 2025
```

### Notebook 1 — Forecast Error Analysis
Sections in order:
1. Data fetching (FUELHH + WINDFOR)
2. `align_at_horizon(actuals, forecasts, horizon_h)` — returns DataFrame with `signed_error`, `abs_error`
3. Overall error distribution at 4h horizon
4. Error vs horizon sweep (1–48h): MAE, RMSE, P99 per horizon
5. Error by time of day (hour 0–23)
6. Error by day of week
7. Error heatmap: hour × horizon grid
8. Summary statistics table + written findings

### Notebook 2 — Wind Reliability Analysis
Sections in order:
1. Data ingestion + quality check (coverage, gaps, physical bounds)
2. Generation percentile table (P1–P99)
3. Approach A: statistical floor (P5, P10) with ECDF
4. Monthly / seasonal breakdown
5. Approach B: sustained low-wind events (`find_low_events()`)
6. Reliability heatmap: season × hour
7. Bootstrap confidence intervals (2000 resamples around P5)
8. Final recommendation with explicit caveats
9. Summary chart: ECDF with annotated recommendation floor

---

## 14. Key Domain Rules — Always Enforce These

1. **Never interpolate missing forecasts** — if no valid forecast exists for a target time at the given horizon, drop that row entirely. `connectNulls={false}` on charts.

2. **Always filter to `fuelType == "WIND"`** when processing FUELHH data. The endpoint returns multiple fuel types.

3. **All timestamps are UTC** — use `pd.to_datetime(..., utc=True)` in Python, always store/transmit as ISO-8601 with `+00:00` or `Z` suffix.

4. **Minimum data date: 2025-01-01** — filter out any records before this in both actuals and forecasts.

5. **Forecast horizon is 0–48 hours** — validate on both backend (`ge=0, le=48` in FastAPI query param) and frontend slider bounds.

6. **Backend does ALL computation** — MAE, RMSE, P99, alignment, horizon filtering. The frontend only renders. No business logic in React components.

7. **Cache key includes horizon** — changing the horizon must invalidate the cache. Key format: `wf:ts:{md5(startISO|endISO|horizon)}`.

8. **NDJSON not JSON** — the Elexon stream endpoints return newline-delimited JSON, not a JSON array. Always parse line by line.

9. **Extended publish window** — when fetching forecasts, set `publishDateTimeFrom = start - 48h` to capture all forecasts relevant for large horizons.

10. **Error = forecast − actual (signed)**, `|forecast − actual|` (absolute). P99 is of absolute errors.

---

## 15. Naming Conventions

### Python (PEP 8 + project-specific)
| Concept | Name |
|---------|------|
| Target time column | `startTime` (matches API field name) |
| Publish time column | `publishTime` (matches API field name) |
| Aligned actual | `actual` |
| Aligned forecast | `forecast` |
| Signed error | `signed_error` |
| Absolute error | `abs_error` |
| Horizon param | `horizon_hours: float` |
| Settings singleton | `get_settings()` |
| Cache service | `CacheService` |
| Async fetch functions | `fetch_actuals()`, `fetch_forecasts()` |

### TypeScript (camelCase)
| Concept | Name |
|---------|------|
| API base | `BASE_URL` |
| Start time state | `startTime: string` |
| End time state | `endTime: string` |
| Horizon state | `horizon: number` |
| Committed query | `params: QueryParams` |
| Show error overlay | `showErrorOverlay: boolean` |
| SWR hook data | `data`, `error`, `isLoading` |

---

## 16. Error Handling Patterns

### Backend
```python
# Upstream failures → 502
try:
    actuals_raw, forecasts_raw = await asyncio.gather(
        fetch_actuals(...), fetch_forecasts(...)
    )
except Exception as exc:
    raise HTTPException(502, f"Failed to fetch from Elexon: {exc}")

# Validation failures → 400 (handled automatically by Pydantic)
# Cache failures are NON-FATAL — log and continue, never raise
```

### Frontend
```typescript
// Loading state → skeleton/pulse UI
// Error state → inline error message (not toast, not modal)
// Empty data → "No data for the selected range and horizon." message
// Never show raw error objects to the user — use error.message
```

---

## 17. Deployment Configuration

### Backend `Procfile`
```
web: uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

### Vercel `frontend/vercel.json` (if needed)
```json
{
  "env": {
    "NEXT_PUBLIC_API_URL": "@wind-forecast-api-url"
  }
}
```

### Railway environment variables
```
DATABASE_URL  postgresql+asyncpg://...
REDIS_URL     redis://...
CACHE_TTL     300
CORS_ORIGINS  ["https://wind-forecast-monitor.vercel.app"]
```

---

## 18. What NOT to Do

- Do NOT use `@app.on_event("startup")` — use `lifespan` context manager instead
- Do NOT compute errors or alignment in the frontend — backend only
- Do NOT use `axios` — the project uses native `fetch` with SWR
- Do NOT use `moment.js` — use `date-fns`
- Do NOT use `useState` for server data — use SWR hooks
- Do NOT use CSS modules or styled-components — Tailwind only
- Do NOT store timestamps as naive (timezone-unaware) — always UTC-aware
- Do NOT fill missing forecast data with 0 or null — drop the row
- Do NOT use `requests` in the backend — use `httpx` (async)
- Do NOT add Redux, Zustand, or any global state library — not needed
- Do NOT use `pd.DataFrame.fillna()` on forecast gaps — drop with `dropna` or skip in loop
- Do NOT use `json.loads(response.text)` on Elexon endpoints — it's NDJSON, parse line by line
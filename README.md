# Wind Forecast Monitor

Forecast vs actual UK wind generation monitoring app with:
- FastAPI backend for timeseries and metrics endpoints
- Next.js frontend dashboard for interactive analysis
- Two analysis notebooks for forecast error and reliability assessment

## Repository Structure

- `backend` FastAPI API service
- `frontend` Next.js dashboard
- `notebooks` analysis notebooks

## Local Development

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend health check:

```bash
curl "http://localhost:8000/health"
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`.

Set `NEXT_PUBLIC_API_URL` in `frontend/.env.local` if needed:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Deployment

## Backend (Railway)

Railway service settings:
- Root Directory: `backend`
- Procfile command: `web: uvicorn main:app --host 0.0.0.0 --port $PORT`

Environment variables:

```env
REDIS_URL=redis://default:xxx@xxx.railway.app:6379
CACHE_TTL=300
ELEXON_TIMEOUT=30
CORS_ORIGINS=["https://your-frontend.vercel.app","http://localhost:3000"]
# Optional if you wire Postgres usage later:
DATABASE_URL=postgresql+asyncpg://user:pass@host/dbname
```

Verify deployed backend:

```bash
curl "https://your-app.railway.app/health"
curl "https://your-app.railway.app/timeseries?start_time=2025-01-15T00:00:00Z&end_time=2025-01-16T00:00:00Z&horizon=4"
```

## Frontend (Vercel)

Vercel project settings:
- Framework preset: Next.js
- Root directory: `frontend`
- Build command: `npm run build`

Environment variable:

```env
NEXT_PUBLIC_API_URL=https://your-app.railway.app
```

## Deployed Application

- Frontend: https://wf-mon.vercel.app
- Backend: https://wfmon-production.up.railway.app

## Demo Video

- Unlisted YouTube: https://youtu.be/TIO7CNg9Hfg

## Submission Artifacts

- GitHub repository: https://github.com/HORRIDBEAST/WFMon
- Google Drive zip (with .git included): https://drive.google.com/file/d/1HSvo2pappXqIS3f3Uf9zyg-JOlKcaJiY/view?usp=sharing
- Submission form: Full Stack SWE challenge submission (all fields mandatory)

## Submission Checklist

- [ ] Railway deployed backend + Redis configured
- [ ] Vercel deployed frontend with `NEXT_PUBLIC_API_URL`
- [ ] Both live endpoints tested (`/health`, `/timeseries`)
- [ ] Both notebooks executed with outputs saved
- [ ] 5-minute demo uploaded as unlisted YouTube video
- [ ] Zip created including `.git` and excluding heavy folders
- [ ] Shareable Drive link generated
- [ ] Submission form filled with repo, deployed app, and video links

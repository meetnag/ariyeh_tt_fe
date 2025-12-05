## Monorepo Skeleton

This repository contains a simple backend and frontend scaffold.

- `backend/`: FastAPI + SQLAlchemy project configured for PostgreSQL with Alembic for migrations.
- `frontend/`: React + TypeScript app bootstrapped with a Vite-style setup.

### Backend

1. Create and activate a virtual environment (example):
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
3. Run the server:
   ```bash
   uvicorn backend.main:app --reload
   ```
4. Health check is available at `http://localhost:8000/health`.
5. Run migrations:
   ```bash
   cd backend
   alembic upgrade head
   ```
6. Create new migration (auto-generate):
   ```bash
   cd backend
   alembic revision --autogenerate -m "message"
   ```
7. Dev without Postgres: set `USE_IN_MEMORY_STORAGE=true` and restart the backend to use an in-memory store (for a couple test records only). For production/deploy, set `DATABASE_URL` to a Postgres instance.

### Quick start backend from repo root

```bash
# optional: create/activate venv
python3 -m venv .venv
source .venv/bin/activate

# install deps
pip install -r backend/requirements.txt

# choose storage:
#   in-memory (no Postgres):
export USE_IN_MEMORY_STORAGE=true
#   or Postgres:
# export DATABASE_URL=postgresql+psycopg2://user:pass@host:port/dbname

# run API
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

If you prefer, you can also run with an explicit `PYTHONPATH`:
```bash
PYTHONPATH=backend uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend API base can be overridden via Vite env:
```
VITE_API_BASE=http://127.0.0.1:8000
```
or set `CORS_ORIGINS` in the backend environment to comma-separated origins when needed.

### Frontend

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```
3. Open the printed URL (defaults to `http://localhost:5173`) to view the app.

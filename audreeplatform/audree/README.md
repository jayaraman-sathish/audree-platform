# Audree — Enterprise Agentic AI Platform (working prototype)

Real full-stack rebuild of the Audree mockup: FastAPI + PostgreSQL backend,
React (Vite) frontend. See `ARCHITECTURE.md` for exactly what is real and
what is simulated.

## Option A — Docker Compose (recommended)

Requires Docker + Docker Compose, and outbound network access (to pull the
`python:3.11-slim`, `node:20-slim`, `postgres:16` images and install pip/npm
dependencies at build time).

```bash
cd audree
docker compose up --build
```

This starts:
- `db` — Postgres 16 on `localhost:5432` (user/pass/db: `audree`/`audree`/`audree`)
- `backend` — FastAPI on `http://localhost:8000` (runs `alembic upgrade head`
  then seeds the database automatically on container start)
- `frontend` — Vite dev server on `http://localhost:5173`

Open `http://localhost:5173` and log in (see demo users below).

## Option B — without Docker (Postgres already available)

### 1. Database

Create a Postgres role/database (adjust to your existing Postgres):

```bash
createuser audree --pwprompt   # password: audree
createdb audree -O audree
```

### 2. Backend

```bash
cd audree/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit DATABASE_URL / JWT_SECRET if needed
alembic upgrade head
python -m app.db.seed
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: `http://localhost:8000/docs`.

### 3. Frontend

```bash
cd audree/frontend
npm install
cp .env.example .env   # VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

Open `http://localhost:5173`.

## Demo users (seeded by `app/db/seed.py`)

| username          | password  | role              |
|-------------------|-----------|-------------------|
| admin             | admin123  | Admin             |
| ppic.user         | ppic123   | PPIC User         |
| ppic.head         | ppic123   | PPIC Head         |
| qa.head           | qa123     | QA Head           |
| md                | md123     | MD                |
| procurement.head  | proc123   | Procurement Head  |
| plant.head        | plant123  | Plant Head        |
| warehouse.head    | wh123     | Warehouse Head    |

Only `Admin` can add/edit/deactivate/publish Configuration Master rows and
edit the simulated enterprise data panel (`/api/v1/sim/*`); all authenticated
users can use the Enterprise Copilot, view scenarios, and approve/reject
their own workflow steps.

## Try it (curl)

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -d "username=admin&password=admin123" \
  -H "Content-Type: application/x-www-form-urlencoded" | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

curl -s http://localhost:8000/api/v1/masters/intent -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

curl -s -X POST http://localhost:8000/api/v1/copilot/chat \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"message":"Can we commit 10 million Amoxicillin 500 mg capsules by 30 Sept?","session_id":"demo"}' \
  | python3 -m json.tool

curl -s http://localhost:8000/api/v1/audit -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

## Repository layout

```
audree/
  backend/     FastAPI app, SQLAlchemy models, Alembic migrations, seed data
  frontend/    React (Vite) app
  docker-compose.yml
ARCHITECTURE.md   what's real vs simulated
```

## Verification performed in the sandbox that built this

See the final report for exact commands run and what could/couldn't be
executed in this particular sandbox (no outbound access to PyPI/npm/Docker
registries and no Docker daemon were available here — the code has been
syntax-checked and the Postgres schema/seed logic was validated directly
against a local Postgres instance; full `pip install` / `npm install` /
`docker compose up` should be run on a machine with normal network access,
per the instructions above).

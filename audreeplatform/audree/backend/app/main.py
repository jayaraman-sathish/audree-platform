from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import routes_auth, routes_masters, routes_scenarios, routes_copilot, routes_misc

app = FastAPI(title="Audree — Enterprise Agentic AI Platform API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes_auth.router)
app.include_router(routes_masters.router)
app.include_router(routes_scenarios.router)
app.include_router(routes_copilot.router)
app.include_router(routes_misc.router)


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}

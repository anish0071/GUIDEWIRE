"""
Project-A — Parametric Insurance Backend
Entry point: mounts all domain routers and initialises the database.
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .routers import (
    auth_router,
    users_router,
    policies_router,
    claims_router,
    simulate_router,
    admin_router,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Project-A — Parametric Insurance API",
    description="Zero-touch parametric insurance for gig workers.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()
    logger.info("Database initialised.")


# Mount all routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(policies_router)
app.include_router(claims_router)
app.include_router(simulate_router)
app.include_router(admin_router)


@app.get("/health")
def health():
    """Health check endpoint."""
    return {"status": "ok", "version": "2.0.0"}


# ---------------------------------------------------------------------------
# ML training endpoint (kept at root level — not domain-specific)
# ---------------------------------------------------------------------------
@app.post("/train-risk")
def train_risk(sample_count: int = 500):
    """Train the risk anomaly model on synthetic demo signals."""
    import numpy as np
    from .risk_model import train_risk_model
    rng = np.random.default_rng(42)
    rain = rng.normal(10, 20, size=sample_count).clip(0, 200)
    traffic = rng.normal(60, 20, size=sample_count).clip(0, 120)
    temp = rng.normal(22, 8, size=sample_count).clip(-10, 60)
    event = rng.integers(0, 2, size=sample_count)
    X = np.vstack([rain, traffic, temp, event]).T
    path = train_risk_model(X)
    return {"model_path": path, "samples_trained": sample_count}

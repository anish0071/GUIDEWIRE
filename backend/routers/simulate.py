"""Simulate router — trigger simulation, presets, history, pricing."""
import logging
import json
from typing import Dict
from fastapi import APIRouter
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import engine
from ..models import SimulationHistory
from ..trigger import evaluate_signals, run_triggers
from ..ai import dynamic_premium
from ..risk_model import anomaly_score, load_risk_model

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/simulate", tags=["simulate"])

PRESETS = {
    "heavy_rain":       {"rain": 120, "traffic": 20,  "temp": 18, "inactivity": 180, "event_flag": False},
    "flood":            {"rain": 180, "traffic": 10,  "temp": 16, "inactivity": 300, "duration_hours": 6},
    "heatwave":         {"rain": 0,   "traffic": 80,  "temp": 45, "inactivity": 60},
    "traffic_collapse": {"rain": 5,   "traffic": 5,   "temp": 22, "inactivity": 90},
    "social_event":     {"rain": 0,   "traffic": 30,  "temp": 22, "event_flag": True, "inactivity": 30},
    "fraud_attempt":    {"rain": 150, "traffic": 5,   "temp": 18, "inactivity": 300, "behavior_anomaly": 0.9, "time_repeat": 0.8},
}


class SimulateRequest(BaseModel):
    user_id: int
    signals: Dict[str, float]


@router.get("/presets")
def get_presets():
    """Return all named simulation presets."""
    return PRESETS


@router.post("/run")
def simulate_run(sim: SimulateRequest):
    """Full simulation: evaluate triggers, create claim, auto-payout if approved."""
    res = run_triggers(sim.user_id, sim.signals)
    metrics = evaluate_signals(sim.signals)
    return {
        "history_id": res.get("history_id"),
        "fired": res.get("fired"),
        "claim_id": res["claim"].claim_id if res.get("claim") else None,
        "claim_status": res["claim"].status if res.get("claim") else None,
        "payout_amount": res["claim"].payout_amount if res.get("claim") else None,
        "metrics": metrics,
    }


@router.get("/history")
def get_history(limit: int = 50):
    """Return recent simulation history."""
    with Session(engine) as session:
        stmt = select(SimulationHistory).order_by(SimulationHistory.timestamp.desc()).limit(limit)
        return session.exec(stmt).all()


@router.get("/ui-defaults")
def ui_defaults():
    """Return default signal values for the simulator UI."""
    return {
        "defaults": {"user_id": 1, "rain": 20, "traffic": 40, "temp": 22, "inactivity": 120},
        "signal_ranges": {
            "rain":       {"min": 0,   "max": 300, "unit": "mm"},
            "traffic":    {"min": 0,   "max": 120, "unit": "km/h"},
            "temp":       {"min": -10, "max": 60,  "unit": "°C"},
            "inactivity": {"min": 0,   "max": 720, "unit": "mins"},
        },
    }


@router.get("/pricing-estimate")
def pricing_estimate(
    user_id: int,
    base: float = 5.0,
    rain: float = 0.0,
    traffic: float = 100.0,
    temp: float = 20.0,
):
    """Estimate dynamic premium + anomaly score for given signals."""
    from ..db import engine as eng
    from ..models import User
    from sqlmodel import Session as S
    signals = {"rain": rain, "traffic": traffic, "temp": temp}
    metrics = evaluate_signals(signals)
    with S(eng) as session:
        user = session.get(User, user_id)
        trust = user.trust_score if user else 50.0
    premium = dynamic_premium(base, metrics["risk"], trust)
    model = load_risk_model()
    anomaly = None
    if model is not None:
        import numpy as np
        anomaly = anomaly_score(np.array([rain, traffic, temp, 0.0]))
    return {"premium": round(premium, 2), "risk": metrics["risk"], "trust": trust, "anomaly": anomaly}

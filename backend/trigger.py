"""Trigger engine and simulator."""
from typing import Dict
from .ai import risk_score, confidence_score, fraud_score
from .models import Claim
from .db import engine
from sqlmodel import Session
from datetime import datetime
import json
from .models import SimulationHistory

def evaluate_signals(signals: Dict[str, float]) -> Dict:
    r = risk_score(signals)
    c = confidence_score(signals)
    # lightweight fraud features
    fraud = fraud_score({
        "location_repeat": signals.get("location_repeat", 0.0),
        "time_repeat": signals.get("time_repeat", 0.0),
        "behavior_anomaly": signals.get("behavior_anomaly", 0.0),
    })
    return {"risk": r, "confidence": c, "fraud": fraud}

def auto_create_claim(user_id: int, signals: Dict[str, float], reason: str = "auto-trigger") -> Claim:
    metrics = evaluate_signals(signals)
    claim = Claim(
        user_id=user_id,
        reason=reason,
        duration=signals.get("inactivity", 0.0),
        confidence_score=metrics["confidence"],
        fraud_score=metrics["fraud"],
        status="approved" if metrics["confidence"] > 0.5 and metrics["fraud"] < 0.4 else "pending",
        payout_amount=0.0,
    )
    with Session(engine) as session:
        session.add(claim)
        session.commit()
        session.refresh(claim)
    return claim


def rain_trigger(signals: Dict[str, float], threshold: float = 30.0) -> bool:
    return signals.get("rain", 0.0) > threshold


def flood_trigger(signals: Dict[str, float], threshold: float = 100.0) -> bool:
    # rain * duration heuristic
    duration = signals.get("duration_hours", 1.0)
    return (signals.get("rain", 0.0) * duration) > threshold


def heat_trigger(signals: Dict[str, float], threshold: float = 40.0) -> bool:
    return signals.get("temp", 0.0) > threshold


def traffic_trigger(signals: Dict[str, float], threshold: float = 20.0) -> bool:
    return signals.get("traffic", 100.0) < threshold


def social_trigger(signals: Dict[str, float]) -> bool:
    return bool(signals.get("event_flag", False))


def run_triggers(user_id: int, signals: Dict[str, float]):
    fired = []
    if rain_trigger(signals):
        fired.append("rain")
    if flood_trigger(signals):
        fired.append("flood")
    if heat_trigger(signals):
        fired.append("heat")
    if traffic_trigger(signals):
        fired.append("traffic")
    if social_trigger(signals):
        fired.append("social")

    claim = None
    # if any critical trigger, create claim
    if fired:
        claim = auto_create_claim(user_id, signals, reason="triggered:" + ",".join(fired))

    # record simulation history
    with Session(engine) as session:
        hist = SimulationHistory(
            user_id=user_id,
            signals=json.dumps(signals),
            triggers_fired=",".join(fired),
            created_claim_id=claim.claim_id if claim else None,
            result_status=claim.status if claim else "no-trigger",
        )
        session.add(hist)
        session.commit()
        session.refresh(hist)

    return {"fired": fired, "claim": claim, "history_id": hist.id}

    return claim

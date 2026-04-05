"""Trigger engine — evaluates parametric signals and fires auto-claims."""
import json
import logging
from typing import Dict

from .ai import risk_score, confidence_score
from .db import engine
from .models import SimulationHistory
from .services.claim_service import create_claim
from sqlmodel import Session

logger = logging.getLogger(__name__)

RAIN_THRESHOLD = 30.0        # mm
FLOOD_THRESHOLD = 100.0      # rain × duration_hours
HEAT_THRESHOLD = 40.0        # °C
TRAFFIC_THRESHOLD = 20.0     # km/h (below = collapse)


def evaluate_signals(signals: Dict[str, float]) -> Dict:
    """Compute risk, confidence, and fraud metrics for a set of signals."""
    from .services.fraud_service import evaluate_full_fraud
    r = risk_score(signals)
    c = confidence_score(signals)
    # Fraud evaluated without user_id context here (0 for system checks)
    fraud = evaluate_full_fraud(0, signals)
    return {"risk": round(r, 4), "confidence": round(c, 4), "fraud": round(fraud, 4)}


def rain_trigger(signals: Dict[str, float]) -> bool:
    return signals.get("rain", 0.0) > RAIN_THRESHOLD


def flood_trigger(signals: Dict[str, float]) -> bool:
    duration = signals.get("duration_hours", 1.0)
    return (signals.get("rain", 0.0) * duration) > FLOOD_THRESHOLD


def heat_trigger(signals: Dict[str, float]) -> bool:
    return signals.get("temp", 0.0) > HEAT_THRESHOLD


def traffic_trigger(signals: Dict[str, float]) -> bool:
    return signals.get("traffic", 100.0) < TRAFFIC_THRESHOLD


def social_trigger(signals: Dict[str, float]) -> bool:
    return bool(signals.get("event_flag", False))


def run_triggers(user_id: int, signals: Dict[str, float]) -> Dict:
    """
    Evaluate all triggers. If any fire, create a claim via ClaimService
    (which handles fraud scoring, auto-approval, and auto-payout).
    Log result to SimulationHistory.
    Returns dict with fired triggers, claim object, and history_id.
    """
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
    if fired:
        reason = "triggered:" + ",".join(fired)
        claim = create_claim(user_id, signals, reason=reason)
        logger.info("Triggers %s fired for user=%s → claim=%s status=%s", fired, user_id, claim.claim_id, claim.status)

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

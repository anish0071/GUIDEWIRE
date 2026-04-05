"""Claim service — creation, approval, rejection, and explanation logic."""
import logging
from typing import Dict, List
from sqlmodel import Session, select

from ..db import engine
from ..models import Claim
from ..ai import confidence_score
from ..services.fraud_service import evaluate_full_fraud, should_reject
from ..services.payout_service import auto_payout_if_approved

logger = logging.getLogger(__name__)

CONFIDENCE_APPROVE_THRESHOLD = 0.5


def create_claim(user_id: int, signals: Dict[str, float], reason: str = "auto-trigger") -> Claim:
    """
    Create a claim with AI-evaluated confidence and fraud scores.
    - Auto-approves if confidence > 0.5 AND fraud < 0.5
    - Auto-rejects if fraud >= 0.5
    - Otherwise stays pending
    Triggers auto-payout if approved.
    """
    conf = confidence_score(signals)
    fraud = evaluate_full_fraud(user_id, signals)
    duration = signals.get("inactivity", 0.0)

    if should_reject(fraud):
        status = "rejected"
        logger.warning("Claim rejected for user_id=%s: fraud_score=%.2f", user_id, fraud)
    elif conf > CONFIDENCE_APPROVE_THRESHOLD:
        status = "approved"
    else:
        status = "pending"

    claim = Claim(
        user_id=user_id,
        reason=reason,
        duration=duration,
        confidence_score=round(conf, 4),
        fraud_score=round(fraud, 4),
        status=status,
        payout_amount=0.0,
    )

    with Session(engine) as session:
        session.add(claim)
        session.commit()
        session.refresh(claim)

    logger.info(
        "Claim created claim_id=%s user=%s status=%s conf=%.2f fraud=%.2f",
        claim.claim_id, user_id, status, conf, fraud,
    )

    # Auto-payout immediately if approved
    if status == "approved":
        auto_payout_if_approved(claim)

    return claim


def get_claim(claim_id: int) -> Claim:
    """Fetch a single claim by ID. Raises ValueError if not found."""
    with Session(engine) as session:
        claim = session.get(Claim, claim_id)
        if not claim:
            raise ValueError(f"Claim {claim_id} not found.")
        return claim


def explain_claim(claim_id: int) -> dict:
    """Return a human-readable explanation of a claim decision."""
    claim = get_claim(claim_id)
    rationale = []

    if claim.status == "rejected":
        rationale.append(f"Fraud score {claim.fraud_score:.0%} exceeded threshold — auto-rejected.")
    elif claim.status == "approved":
        rationale.append(f"Confidence {claim.confidence_score:.0%} above threshold with low fraud — auto-approved.")
    elif claim.status == "paid":
        rationale.append(f"Claim approved and payout of ₹{claim.payout_amount:.2f} credited to wallet.")
    else:
        rationale.append(f"Confidence {claim.confidence_score:.0%} below threshold — pending manual review.")

    if claim.fraud_score > 0.3:
        rationale.append(f"Elevated fraud indicators ({claim.fraud_score:.0%}) — flagged for review.")

    return {
        "claim_id": claim.claim_id,
        "user_id": claim.user_id,
        "status": claim.status,
        "reason": claim.reason,
        "confidence_score": claim.confidence_score,
        "fraud_score": claim.fraud_score,
        "duration_mins": claim.duration,
        "payout_amount": claim.payout_amount,
        "rationale": rationale,
    }


def list_claims(limit: int = 50) -> List[Claim]:
    """Return the most recent claims ordered by timestamp."""
    with Session(engine) as session:
        stmt = select(Claim).order_by(Claim.timestamp.desc()).limit(limit)
        return session.exec(stmt).all()

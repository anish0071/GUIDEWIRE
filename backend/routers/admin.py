"""Admin router — monitoring, fraud alerts, analytics."""
import logging
from fastapi import APIRouter
from sqlmodel import Session, select, func

from ..db import engine
from ..models import Claim, User, Policy, Transaction, OTPRecord
from ..services.fraud_service import dbscan_cluster_fraud
import json

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/claims")
def list_all_claims(limit: int = 50):
    """Return most recent claims with user context."""
    with Session(engine) as session:
        stmt = select(Claim).order_by(Claim.timestamp.desc()).limit(limit)
        return session.exec(stmt).all()


@router.get("/fraud-alerts")
def fraud_alerts(threshold: float = 0.5):
    """Return all claims with fraud_score above threshold."""
    with Session(engine) as session:
        stmt = select(Claim).where(Claim.fraud_score >= threshold).order_by(Claim.fraud_score.desc())
        flagged = session.exec(stmt).all()
        return {
            "total_flagged": len(flagged),
            "threshold": threshold,
            "claims": flagged,
        }


@router.get("/stats")
def system_stats():
    """Return aggregate system statistics."""
    with Session(engine) as session:
        total_users = session.exec(select(func.count(User.id))).one()
        total_policies = session.exec(select(func.count(Policy.policy_id))).one()
        total_claims = session.exec(select(func.count(Claim.claim_id))).one()
        approved = session.exec(select(func.count(Claim.claim_id)).where(Claim.status == "approved")).one()
        rejected = session.exec(select(func.count(Claim.claim_id)).where(Claim.status == "rejected")).one()
        paid = session.exec(select(func.count(Claim.claim_id)).where(Claim.status == "paid")).one()
        total_payout = session.exec(select(func.sum(Claim.payout_amount))).one() or 0.0
    return {
        "users": total_users,
        "policies": total_policies,
        "claims": {
            "total": total_claims,
            "approved": approved,
            "rejected": rejected,
            "paid": paid,
        },
        "total_payout_issued": round(float(total_payout), 2),
    }


@router.post("/fraud/dbscan-scan")
def dbscan_fraud_scan():
    """
    Run DBSCAN cluster fraud detection on recent simulation signals.
    Returns flagged claim IDs.
    """
    from ..models import SimulationHistory
    with Session(engine) as session:
        rows = session.exec(
            select(SimulationHistory).order_by(SimulationHistory.timestamp.desc()).limit(200)
        ).all()

    vectors = []
    claim_ids = []
    for row in rows:
        if not row.signals:
            continue
        try:
            s = json.loads(row.signals)
            vec = [
                float(s.get("rain", 0)),
                float(s.get("traffic", 100)),
                float(s.get("temp", 22)),
                float(s.get("inactivity", 0)),
            ]
            vectors.append(vec)
            claim_ids.append(row.created_claim_id)
        except Exception:
            continue

    flagged_mask = dbscan_cluster_fraud(vectors)
    flagged_claims = [cid for cid, flag in zip(claim_ids, flagged_mask) if flag and cid]

@router.get("/otps")
def list_active_otps():
    """Return all active OTP records from the DB (for demo/debugging)."""
    with Session(engine) as session:
        stmt = select(OTPRecord).order_by(OTPRecord.expires_at.desc())
        return session.exec(stmt).all()


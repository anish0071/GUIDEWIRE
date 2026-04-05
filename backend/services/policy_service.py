"""Policy service — subscription, expiry, renewal business logic."""
import logging
from typing import Dict, List, Optional
from datetime import date, timedelta
from sqlmodel import Session, select

from ..models import Policy, User
from ..db import engine
from ..ai import dynamic_premium
from ..trigger import evaluate_signals

logger = logging.getLogger(__name__)

PLAN_CATALOGUE = {
    "weekly_basic":   {"base_premium": 5.0,  "coverage_limit": 1000.0},
    "weekly_premium": {"base_premium": 10.0, "coverage_limit": 2000.0},
}


def list_plans() -> List[Dict]:
    """Return available insurance plan catalogue."""
    return [
        {"plan": name, "base": meta["base_premium"], "coverage": meta["coverage_limit"]}
        for name, meta in PLAN_CATALOGUE.items()
    ]


def subscribe(user_id: int, plan_type: str, signals: Optional[Dict] = None) -> Policy:
    """
    Subscribe a user to a plan. Premium is computed dynamically from
    current environmental signals + user trust score.
    Raises ValueError if plan_type is invalid.
    """
    if plan_type not in PLAN_CATALOGUE:
        raise ValueError(f"Unknown plan '{plan_type}'. Choose from {list(PLAN_CATALOGUE)}")

    plan_meta = PLAN_CATALOGUE[plan_type]
    base = plan_meta["base_premium"]

    with Session(engine) as session:
        user = session.get(User, user_id)
        trust = user.trust_score if user else 50.0

    signals = signals or {"rain": 0.0, "traffic": 100.0, "temp": 22.0}
    metrics = evaluate_signals(signals)
    premium = dynamic_premium(base, metrics["risk"], trust)

    start = date.today()
    end = start + timedelta(days=7)
    policy = Policy(
        user_id=user_id,
        plan_type=plan_type,
        premium=round(premium, 2),
        coverage_limit=plan_meta["coverage_limit"],
        coverage_remaining=plan_meta["coverage_limit"],
        start_date=start,
        end_date=end,
        status="active",
    )
    with Session(engine) as session:
        session.add(policy)
        session.commit()
        session.refresh(policy)
    logger.info("User %s subscribed to %s at premium %.2f", user_id, plan_type, premium)
    return policy


def check_and_expire_policies() -> int:
    """
    Mark all policies past their end_date as expired.
    Returns count of policies expired.
    """
    today = date.today()
    with Session(engine) as session:
        stmt = select(Policy).where(Policy.end_date < today, Policy.status == "active")
        expired = session.exec(stmt).all()
        for p in expired:
            p.status = "expired"
            session.add(p)
        session.commit()
        if expired:
            logger.info("Expired %d policies", len(expired))
        return len(expired)


def renew_policy(policy_id: int) -> Policy:
    """Renew an expired policy by another 7-day window."""
    with Session(engine) as session:
        policy = session.get(Policy, policy_id)
        if not policy:
            raise ValueError("Policy not found.")
        if policy.status not in ("expired", "active"):
            raise ValueError("Only active or expired policies can be renewed.")
        policy.start_date = date.today()
        policy.end_date = date.today() + timedelta(days=7)
        policy.coverage_remaining = policy.coverage_limit
        policy.status = "active"
        session.add(policy)
        session.commit()
        session.refresh(policy)
        logger.info("Policy %s renewed for user %s", policy_id, policy.user_id)
        return policy


def get_active_policy(user_id: int) -> Optional[Policy]:
    """Return the most recent active policy for a user, auto-expiring stale ones."""
    check_and_expire_policies()
    with Session(engine) as session:
        stmt = (
            select(Policy)
            .where(Policy.user_id == user_id, Policy.status == "active")
            .order_by(Policy.start_date.desc())
        )
        return session.exec(stmt).first()

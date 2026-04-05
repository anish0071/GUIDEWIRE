"""Payout service — compute, apply, and credit payouts to user wallet."""
import logging
from typing import Optional
from sqlmodel import Session

from ..db import engine
from ..models import Claim, Transaction, User
from ..ai import payout_calc

logger = logging.getLogger(__name__)

HOURLY_INCOME_DEFAULT = 10.0  # rupees/hour fallback if not on user profile


def process_payout(claim_id: int) -> dict:
    """
    Compute payout for an approved claim, persist it, and credit user wallet.
    Raises ValueError for invalid claim states.
    """
    with Session(engine) as session:
        claim = session.get(Claim, claim_id)
        if not claim:
            raise ValueError(f"Claim {claim_id} not found.")
        if claim.status != "approved":
            raise ValueError(f"Claim {claim_id} is '{claim.status}' — only approved claims can be paid out.")

        # Determine hourly income from user profile
        user = session.get(User, claim.user_id)
        hourly = (user.daily_earnings / 8.0) if (user and user.daily_earnings) else HOURLY_INCOME_DEFAULT
        duration = claim.duration or 0.0

        amount = payout_calc(hourly, duration)

        # Update claim
        claim.payout_amount = amount
        claim.status = "paid"
        session.add(claim)

        # Record transaction
        txn = Transaction(
            user_id=claim.user_id,
            amount=amount,
            type="payout",
            status="completed",
        )
        session.add(txn)

        # Credit wallet
        if user:
            user.wallet_balance = (user.wallet_balance or 0.0) + amount
            session.add(user)

        session.commit()
        session.refresh(claim)

    logger.info("Payout of %.2f processed for claim %s (user %s)", amount, claim_id, claim.user_id)
    return {"claim_id": claim_id, "payout": amount, "wallet_credited": True}


def auto_payout_if_approved(claim: Claim) -> Optional[dict]:
    """
    If claim is approved, immediately trigger payout. Called after auto_create_claim.
    Returns payout result dict or None if not approved.
    """
    if claim.status == "approved":
        return process_payout(claim.claim_id)
    return None

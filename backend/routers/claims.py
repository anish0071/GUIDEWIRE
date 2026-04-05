"""Claims router — creation, status, payout, explanation."""
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from ..services.claim_service import create_claim, get_claim, explain_claim
from ..services.payout_service import process_payout

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/claims", tags=["claims"])


class ManualClaimRequest(BaseModel):
    user_id: int
    reason: Optional[str] = "manual"
    inactivity: Optional[float] = 0.0


@router.post("/")
def submit_claim(req: ManualClaimRequest):
    """Manually submit a claim. AI scores are computed automatically."""
    signals = {"inactivity": req.inactivity}
    claim = create_claim(req.user_id, signals, reason=req.reason)
    return claim


@router.get("/{claim_id}")
def claim_status(claim_id: int):
    """Get the current status of a claim."""
    try:
        return get_claim(claim_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{claim_id}/payout")
def trigger_payout(claim_id: int):
    """
    Manually trigger payout for an approved claim.
    (Auto-payout fires automatically on claim approval for simulator flow.)
    """
    try:
        return process_payout(claim_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{claim_id}/explain")
def claim_explanation(claim_id: int):
    """Return XAI explanation for a claim decision."""
    try:
        return explain_claim(claim_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

"""Policies router — plan catalogue, subscription, expiry, renewal."""
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from ..services.policy_service import list_plans, subscribe, renew_policy, get_active_policy

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/policies", tags=["policies"])


class SubscribeRequest(BaseModel):
    user_id: int
    plan_type: str
    rain: Optional[float] = 0.0
    traffic: Optional[float] = 100.0
    temp: Optional[float] = 22.0


@router.get("/plans")
def get_plans():
    """Return all available insurance plans."""
    return list_plans()


@router.post("/subscribe")
def subscribe_plan(req: SubscribeRequest):
    """Subscribe a user to a plan with dynamically computed premium."""
    try:
        signals = {"rain": req.rain, "traffic": req.traffic, "temp": req.temp}
        policy = subscribe(req.user_id, req.plan_type, signals)
        return policy
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{user_id}/active")
def active_policy(user_id: int):
    """Return the current active policy for a user (auto-expires stale policies)."""
    policy = get_active_policy(user_id)
    if not policy:
        return {"detail": "No active policy found."}
    return policy


@router.post("/{policy_id}/renew")
def renew(policy_id: int):
    """Renew an existing policy for another 7 days."""
    try:
        return renew_policy(policy_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

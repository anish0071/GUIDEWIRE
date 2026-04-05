"""Users router — profile management."""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from ..db import engine
from ..models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/users", tags=["users"])


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    location: Optional[str] = None
    work_type: Optional[str] = None
    daily_earnings: Optional[float] = None


class ProfileResponse(BaseModel):
    id: int
    name: str
    phone: str
    age: Optional[int]
    gender: Optional[str]
    location: Optional[str]
    work_type: Optional[str]
    daily_earnings: Optional[float]
    trust_score: float
    wallet_balance: float


@router.get("/{user_id}/profile", response_model=ProfileResponse)
def get_profile(user_id: int):
    """Retrieve a user's full profile."""
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        return user


@router.patch("/{user_id}/profile", response_model=ProfileResponse)
def update_profile(user_id: int, update: ProfileUpdateRequest):
    """Partially update a user profile (only provided fields)."""
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        for field, value in update.dict(exclude_unset=True).items():
            setattr(user, field, value)
        session.add(user)
        session.commit()
        session.refresh(user)
        logger.info("Profile updated for user_id=%s", user_id)
        return user


@router.post("/{user_id}/trust")
def update_trust(
    user_id: int,
    valid_claims: int = 0,
    rejected_claims: int = 0,
    activity_level: float = 0.5,
):
    """Recalculate and persist a user's trust score."""
    from ..ai import trust_score
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")
        user.trust_score = trust_score(valid_claims, rejected_claims, activity_level)
        session.add(user)
        session.commit()
        session.refresh(user)
        return {"user_id": user.id, "trust_score": user.trust_score}

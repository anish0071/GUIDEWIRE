"""Auth router — OTP login and session verification."""
import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from ..db import engine
from ..models import User, OTPRecord

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

# In-memory session store (remains for tokens)
_session_store: Dict[str, Dict] = {}

OTP_EXPIRY_MINUTES = 5


class LoginRequest(BaseModel):
    phone: str


class VerifyOTPRequest(BaseModel):
    phone: str
    otp: str


class LoginResponse(BaseModel):
    status: str
    message: str


class SessionResponse(BaseModel):
    token: str
    user_id: int


def get_user_id_from_token(token: str) -> Optional[int]:
    """Look up session token and return user_id, or None if invalid."""
    session_data = _session_store.get(token)
    if not session_data:
        return None
    return session_data.get("user_id")


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest):
    """Generate and store an OTP in the DB for the given phone number."""
    otp = str(100000 + (uuid.uuid4().int % 900000))
    expiry = datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES)

    with Session(engine) as session:
        # Upsert OTPRecord
        record = session.get(OTPRecord, req.phone)
        if record:
            record.otp = otp
            record.expires_at = expiry
        else:
            record = OTPRecord(phone=req.phone, otp=otp, expires_at=expiry)
        session.add(record)
        session.commit()

    logger.info("OTP generated for phone ending ...%s (stored in DB)", req.phone[-4:])
    # In production: send via SMS gateway. For demo, return in response.
    return {"status": "ok", "message": f"OTP sent. (demo OTP: {otp})"}


@router.post("/verify-otp", response_model=SessionResponse)
def verify_otp(req: VerifyOTPRequest):
    """Verify OTP from DB, create user if new, return session token."""
    with Session(engine) as session:
        # 1. Fetch and validate OTP
        record = session.get(OTPRecord, req.phone)
        if not record or record.otp != req.otp:
            raise HTTPException(status_code=400, detail="Invalid OTP.")

        if record.expires_at < datetime.utcnow():
            session.delete(record)
            session.commit()
            raise HTTPException(status_code=400, detail="OTP expired.")

        # 2. Consume OTP
        session.delete(record)

        # 3. Handle User
        user = session.exec(select(User).where(User.phone == req.phone)).first()
        if not user:
            user = User(name="Akshay", phone=req.phone)
            session.add(user)
            session.commit()
            session.refresh(user)

        user_id = user.id  # captured while session open

        # 4. Cleanup and commit
        session.commit()

    token = str(uuid.uuid4())
    _session_store[token] = {"phone": req.phone, "user_id": user_id}
    logger.info("Session created for user_id=%s", user_id)
    return {"token": token, "user_id": user_id}

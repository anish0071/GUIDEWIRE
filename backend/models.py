from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime, date


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    phone: str
    age: Optional[int] = None
    gender: Optional[str] = None
    location: Optional[str] = None
    work_type: Optional[str] = None
    daily_earnings: Optional[float] = None
    trust_score: float = 50.0
    device_id: Optional[str] = None
    wallet_balance: float = 0.0


class Policy(SQLModel, table=True):
    policy_id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int
    plan_type: str
    premium: float
    coverage_limit: float
    coverage_remaining: float
    start_date: date
    end_date: date
    status: str = "active"  # active | expired | renewed


class Claim(SQLModel, table=True):
    claim_id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    reason: Optional[str] = None
    duration: Optional[float] = None
    confidence_score: float = 0.0
    fraud_score: float = 0.0
    status: str = "pending"  # pending | approved | rejected | paid
    payout_amount: float = 0.0


class Transaction(SQLModel, table=True):
    txn_id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int
    amount: float
    type: str           # payout | withdraw | premium
    status: str = "completed"
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class SignalData(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    location: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    rainfall: Optional[float] = 0.0
    temperature: Optional[float] = 0.0
    traffic_speed: Optional[float] = 100.0
    event_flag: Optional[bool] = False


class SimulationHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    signals: Optional[str] = None        # JSON string
    triggers_fired: Optional[str] = None
    created_claim_id: Optional[int] = None
    result_status: Optional[str] = None


class OTPRecord(SQLModel, table=True):
    phone: str = Field(primary_key=True)
    otp: str
    expires_at: datetime = Field(default_factory=lambda: datetime.utcnow())


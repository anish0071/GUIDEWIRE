from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict
from datetime import date, timedelta
from sqlmodel import Session, select
from .db import init_db, engine
from .models import User, Policy, Claim, Transaction
from .ai import dynamic_premium, payout_calc, trust_score
from .trigger import evaluate_signals, auto_create_claim, run_triggers
from .models import SimulationHistory
from .risk_model import train_risk_model, anomaly_score, load_risk_model
import uuid

app = FastAPI(title="PROJECT-A Parametric Insurance - Backend")

# Simple in-memory OTP/session store for demo
_otp_store = {}
_session_store = {}


class LoginRequest(BaseModel):
    phone: str


class VerifyOTP(BaseModel):
    phone: str
    otp: str


class ProfileUpdate(BaseModel):
    name: Optional[str]
    age: Optional[int]
    gender: Optional[str]
    location: Optional[str]


class SubscribeRequest(BaseModel):
    user_id: int
    plan_type: str
    base_premium: float


class SimulateTrigger(BaseModel):
    user_id: int
    signals: Dict[str, float]


@app.on_event("startup")
def on_startup():
    init_db()


@app.post("/login")
def login(req: LoginRequest):
    otp = str(100000 + (uuid.uuid4().int % 900000))
    _otp_store[req.phone] = otp
    return {"status": "ok", "otp": otp}


@app.post("/verify-otp")
def verify(req: VerifyOTP):
    expected = _otp_store.get(req.phone)
    if not expected or expected != req.otp:
        raise HTTPException(status_code=400, detail="invalid otp")
    token = str(uuid.uuid4())
    _session_store[token] = {"phone": req.phone}
    # create user if not exists
    with Session(engine) as session:
        user = session.exec(select(User).where(User.phone == req.phone)).first()
        if not user:
            user = User(name="New User", phone=req.phone)
            session.add(user)
            session.commit()
            session.refresh(user)
    return {"token": token, "user_id": user.id}


@app.get("/profile")
def get_profile(user_id: int):
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="user not found")
        return user


@app.post("/update-profile")
def update_profile(user_id: int, update: ProfileUpdate):
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="user not found")
        for k, v in update.dict(exclude_unset=True).items():
            setattr(user, k, v)
        session.add(user)
        session.commit()
        session.refresh(user)
        return user


@app.get("/plans")
def get_plans():
    return [{"plan": "weekly_basic", "base": 5.0}, {"plan": "weekly_premium", "base": 10.0}]


@app.post("/subscribe")
def subscribe(req: SubscribeRequest):
    start = date.today()
    end = start + timedelta(days=7)
    policy = Policy(user_id=req.user_id, plan_type=req.plan_type, premium=req.base_premium, coverage_limit=1000.0, coverage_remaining=1000.0, start_date=start, end_date=end)
    with Session(engine) as session:
        session.add(policy)
        session.commit()
        session.refresh(policy)
    return policy


@app.get("/dynamic-premium")
def get_dynamic_premium(user_id: int, base: float = 5.0, rain: float = 0.0, traffic: float = 100.0, temp: float = 20.0):
    signals = {"rain": rain, "traffic": traffic, "temp": temp}
    metrics = evaluate_signals(signals)
    with Session(engine) as session:
        user = session.get(User, user_id)
        trust = user.trust_score if user else 50.0
    premium = dynamic_premium(base, metrics["risk"], trust)
    return {"premium": premium, "risk": metrics["risk"], "trust": trust}


@app.get("/check-disruption")
def check_disruption(rain: float = 0.0, traffic: float = 100.0, temp: float = 20.0):
    signals = {"rain": rain, "traffic": traffic, "temp": temp}
    return evaluate_signals(signals)


@app.post("/claim")
def create_claim(user_id: int, reason: Optional[str] = "manual"):
    with Session(engine) as session:
        claim = Claim(user_id=user_id, reason=reason, status="pending")
        session.add(claim)
        session.commit()
        session.refresh(claim)
    return claim


@app.get("/claim-status")
def claim_status(claim_id: int):
    with Session(engine) as session:
        claim = session.get(Claim, claim_id)
        if not claim:
            raise HTTPException(status_code=404, detail="claim not found")
        return claim


@app.post("/withdraw")
def withdraw(user_id: int, amount: float):
    txn = Transaction(user_id=user_id, amount=amount, type="withdraw")
    with Session(engine) as session:
        session.add(txn)
        session.commit()
        session.refresh(txn)
    return txn


@app.post("/simulate/trigger")
def simulate_trigger(sim: SimulateTrigger, background_tasks: BackgroundTasks):
    # Evaluate and auto-create claim in background
    metrics = evaluate_signals(sim.signals)
    # create claim immediately for demo
    claim = auto_create_claim(sim.user_id, sim.signals, reason="simulated")
    return {"created_claim_id": claim.claim_id, "status": claim.status, "metrics": metrics}


@app.post("/simulate/run")
def simulate_run(sim: SimulateTrigger):
    """Run full trigger evaluation, create claim if fired, and return history entry."""
    res = run_triggers(sim.user_id, sim.signals)
    # attach metrics
    metrics = evaluate_signals(sim.signals)
    return {"history_id": res.get("history_id"), "fired": res.get("fired"), "claim_id": res.get("claim").claim_id if res.get("claim") else None, "metrics": metrics}


@app.get("/simulate/presets")
def simulate_presets():
    presets = {
        "heavy_rain": {"rain": 120, "traffic": 20, "temp": 18, "inactivity": 180, "event_flag": False},
        "flood": {"rain": 180, "duration_hours": 6, "traffic": 10, "temp": 16, "inactivity": 300},
        "heatwave": {"rain": 0, "traffic": 80, "temp": 45, "inactivity": 60},
        "traffic_collapse": {"rain": 5, "traffic": 5, "temp": 22, "inactivity": 90},
        "social_event": {"rain": 0, "traffic": 30, "temp": 22, "event_flag": True, "inactivity": 30}
    }
    return presets


@app.get("/simulate/history")
def simulate_history(limit: int = 50):
    with Session(engine) as session:
        stmt = select(SimulationHistory).order_by(SimulationHistory.timestamp.desc()).limit(limit)
        rows = session.exec(stmt).all()
        return rows


@app.get("/simulate/ui")
def simulate_ui():
    # Return recommended default signals and quick-help for frontend simulator
    return {
        "defaults": {"user_id": 1, "rain": 20, "traffic": 40, "temp": 22, "inactivity": 120},
        "help": "Adjust sliders and click 'Run Simulation' to create an auto-claim via /simulate/trigger"
    }


@app.post("/payout")
def payout(claim_id: int, hourly_income: float = 10.0):
    """Calculate and apply payout for an approved claim."""
    with Session(engine) as session:
        claim = session.get(Claim, claim_id)
        if not claim:
            raise HTTPException(status_code=404, detail="claim not found")
        if claim.status != "approved":
            raise HTTPException(status_code=400, detail="claim not approved")
        # compute payout
        duration = claim.duration or 0.0
        amount = payout_calc(hourly_income, duration)
        claim.payout_amount = amount
        claim.status = "paid"
        session.add(claim)
        txn = Transaction(user_id=claim.user_id, amount=amount, type="payout", status="completed")
        session.add(txn)
        session.commit()
        session.refresh(claim)
        session.refresh(txn)
    return {"claim_id": claim.claim_id, "payout": amount}


@app.get("/claim-explain")
def claim_explain(claim_id: int):
    """Return an explanation for a claim decision: inputs, scores and rationale."""
    with Session(engine) as session:
        claim = session.get(Claim, claim_id)
        if not claim:
            raise HTTPException(status_code=404, detail="claim not found")
        explanation = {
            "claim_id": claim.claim_id,
            "user_id": claim.user_id,
            "reason": claim.reason,
            "confidence_score": claim.confidence_score,
            "fraud_score": claim.fraud_score,
            "duration": claim.duration,
            "rationale": []
        }
        if claim.confidence_score > 0.7:
            explanation["rationale"].append("High multi-signal confidence: auto-approve")
        else:
            explanation["rationale"].append("Confidence below threshold: needs review")
        if claim.fraud_score > 0.5:
            explanation["rationale"].append("Fraud indicators detected — escalate to review")
        return explanation


@app.get("/admin/claims")
def admin_list_claims(limit: int = 50):
    with Session(engine) as session:
        stmt = select(Claim).order_by(Claim.timestamp.desc()).limit(limit)
        results = session.exec(stmt).all()
        return results


@app.post("/train-risk")
def train_risk(sample_count: int = 500):
    """Train a risk isolation model on generated demo signals. Returns model path."""
    import numpy as np
    # generate demo synthetic signals: [rain, traffic, temp, event]
    rng = np.random.default_rng(42)
    rain = rng.normal(10, 20, size=sample_count).clip(0, 200)
    traffic = rng.normal(60, 20, size=sample_count).clip(0, 120)
    temp = rng.normal(22, 8, size=sample_count).clip(-10, 60)
    event = rng.integers(0, 2, size=sample_count)
    X = np.vstack([rain, traffic, temp, event]).T
    path = train_risk_model(X)
    return {"model_path": path}


@app.post("/update-trust")
def update_trust(user_id: int, valid_claims: int = 0, rejected_claims: int = 0, activity_level: float = 0.5):
    with Session(engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="user not found")
        new_score = trust_score(valid_claims, rejected_claims, activity_level)
        user.trust_score = new_score
        session.add(user)
        session.commit()
        session.refresh(user)
    return {"user_id": user.id, "trust_score": user.trust_score}


@app.get("/pricing/estimate")
def pricing_estimate(user_id: int, base: float = 5.0, rain: float = 0.0, traffic: float = 100.0, temp: float = 20.0):
    signals = {"rain": rain, "traffic": traffic, "temp": temp}
    metrics = evaluate_signals(signals)
    with Session(engine) as session:
        user = session.get(User, user_id)
        trust = user.trust_score if user else 50.0
    premium = dynamic_premium(base, metrics["risk"], trust)
    # include model anomaly check if available
    anomaly = None
    model = load_risk_model()
    if model is not None:
        from numpy import array
        an = anomaly_score(array([rain, traffic, temp, signals.get('event', 0.0)]))
        anomaly = an
    return {"premium": premium, "risk": metrics["risk"], "trust": trust, "anomaly": anomaly}

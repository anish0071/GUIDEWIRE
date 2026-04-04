"""Simple AI / math models for risk, pricing, confidence, fraud and payout."""
from typing import Dict
import numpy as np

def risk_score(signals: Dict[str, float], weights=None) -> float:
    # signals: {"rain": mm, "traffic": speed, "temp": C, "event": 0/1}
    if weights is None:
        weights = {"rain": 0.4, "traffic": 0.25, "temp": 0.2, "event": 0.15}
    r = 0.0
    # normalize inputs
    rain = min(signals.get("rain", 0.0) / 100.0, 1.0)
    traffic = 1.0 - min(signals.get("traffic", 100.0) / 100.0, 1.0)
    temp = min(max((signals.get("temp", 20.0) - 20.0) / 40.0, 0.0), 1.0)
    event = float(signals.get("event", 0.0))
    r = weights["rain"] * rain + weights["traffic"] * traffic + weights["temp"] * temp + weights["event"] * event
    return float(np.clip(r, 0.0, 1.0))

def dynamic_premium(base: float, risk: float, trust_score: float, alpha=1.0, beta=0.01) -> float:
    # Premium = Base + alpha * Risk - beta * TrustScore
    premium = base + alpha * (risk * base) - beta * trust_score
    return max(0.0, float(premium))

def confidence_score(signals: Dict[str, float], weights=None) -> float:
    if weights is None:
        weights = {"rain": 0.35, "traffic": 0.25, "time": 0.2, "inactivity": 0.2}
    s = 0.0
    rain = min(signals.get("rain", 0.0) / 100.0, 1.0)
    traffic = 1.0 - min(signals.get("traffic", 100.0) / 100.0, 1.0)
    time = 1.0 if signals.get("time", 12) in range(0,6) else 0.0
    inactivity = min(signals.get("inactivity", 0.0) / 240.0, 1.0)
    s = weights["rain"]*rain + weights["traffic"]*traffic + weights["time"]*time + weights["inactivity"]*inactivity
    return float(np.clip(s, 0.0, 1.0))

def fraud_score(features: Dict[str, float]) -> float:
    # lightweight heuristic: higher if anomalies in location/time/behavior
    score = 0.0
    score += 0.5 * features.get("location_repeat", 0.0)
    score += 0.3 * features.get("time_repeat", 0.0)
    score += 0.2 * features.get("behavior_anomaly", 0.0)
    return float(np.clip(score, 0.0, 1.0))

def payout_calc(hourly_income: float, duration_hours: float, daily_cap: float = 500.0, weekly_limit: float = 2000.0) -> float:
    payout = hourly_income * duration_hours
    payout = min(payout, daily_cap)
    payout = min(payout, weekly_limit)
    return float(max(0.0, payout))

def trust_score(valid_claims:int, rejected_claims:int, activity_level:float) -> float:
    # simple trust calculation
    score = 50.0 + 5.0 * max(0, valid_claims - rejected_claims) + 10.0 * np.clip(activity_level, 0.0, 1.0)
    return float(np.clip(score, 0.0, 100.0))

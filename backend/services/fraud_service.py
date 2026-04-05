"""Fraud service — rule-based + DBSCAN cluster fraud detection."""
import logging
import numpy as np
from typing import Dict, List
from sqlmodel import Session, select

from ..db import engine
from ..models import Claim
from ..ai import fraud_score as rule_fraud_score

logger = logging.getLogger(__name__)

# Thresholds
FRAUD_REJECT_THRESHOLD = 0.5      # fraud_score above this → rejected
REPEAT_CLAIM_WINDOW_HOURS = 24    # flag if user filed >N claims within this window
REPEAT_CLAIM_MAX = 3              # max allowed claims within window


def check_repeat_claims(user_id: int) -> float:
    """
    Return a repeat-claim anomaly score (0–1).
    Score increases as user files more claims within REPEAT_CLAIM_WINDOW_HOURS.
    """
    from datetime import datetime, timedelta
    cutoff = datetime.utcnow() - timedelta(hours=REPEAT_CLAIM_WINDOW_HOURS)
    with Session(engine) as session:
        stmt = select(Claim).where(
            Claim.user_id == user_id,
            Claim.timestamp >= cutoff,
        )
        recent = session.exec(stmt).all()
    count = len(recent)
    score = min(count / REPEAT_CLAIM_MAX, 1.0)
    if score > 0.5:
        logger.warning("Repeat claim flag for user_id=%s: %d claims in %dh", user_id, count, REPEAT_CLAIM_WINDOW_HOURS)
    return score


def dbscan_cluster_fraud(signal_batch: List[List[float]], eps: float = 0.5, min_samples: int = 3) -> List[bool]:
    """
    Run DBSCAN on a batch of signal vectors to detect coordinated fraud.
    Returns a list of booleans: True = likely fraudulent cluster member.

    signal_batch: list of [rain, traffic, temp, inactivity] vectors.
    Points labelled as noise (-1) or in suspiciously tight clusters are flagged.
    """
    try:
        from sklearn.cluster import DBSCAN
        from sklearn.preprocessing import StandardScaler
    except ImportError:
        logger.warning("scikit-learn not available — DBSCAN skipped.")
        return [False] * len(signal_batch)

    if len(signal_batch) < min_samples:
        return [False] * len(signal_batch)

    X = StandardScaler().fit_transform(np.array(signal_batch))
    labels = DBSCAN(eps=eps, min_samples=min_samples).fit_predict(X)

    # Count cluster sizes
    from collections import Counter
    cluster_sizes = Counter(labels)

    flagged = []
    for label in labels:
        if label == -1:
            # Noise — isolated anomaly
            flagged.append(True)
        elif cluster_sizes[label] >= min_samples:
            # Suspiciously tight cluster — potential coordinated fraud
            flagged.append(True)
        else:
            flagged.append(False)
    return flagged


def evaluate_full_fraud(user_id: int, signals: Dict[str, float]) -> float:
    """
    Compute composite fraud score combining:
      - Rule-based heuristics (location/time/behavior)
      - Repeat claim pattern
    Returns 0–1 float. Higher = more suspicious.
    """
    rule_score = rule_fraud_score({
        "location_repeat": signals.get("location_repeat", 0.0),
        "time_repeat": signals.get("time_repeat", 0.0),
        "behavior_anomaly": signals.get("behavior_anomaly", 0.0),
    })
    repeat_score = check_repeat_claims(user_id)

    # Weighted composite
    composite = 0.6 * rule_score + 0.4 * repeat_score
    logger.debug(
        "Fraud eval user=%s rule=%.2f repeat=%.2f composite=%.2f",
        user_id, rule_score, repeat_score, composite,
    )
    return round(float(np.clip(composite, 0.0, 1.0)), 4)


def should_reject(fraud_score: float) -> bool:
    """Return True if the fraud score warrants automatic claim rejection."""
    return fraud_score >= FRAUD_REJECT_THRESHOLD

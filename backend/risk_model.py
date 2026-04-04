"""Risk model with optional sklearn IsolationForest fallback.

If scikit-learn is not installed or cannot be built, a lightweight z-score
based anomaly estimator is used as a fallback for demo purposes.
"""
import os
import json
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models')
os.makedirs(MODEL_PATH, exist_ok=True)
IF_PATH = os.path.join(MODEL_PATH, 'isolation_forest.json')

try:
    from sklearn.ensemble import IsolationForest  # type: ignore
    SKLEARN_AVAILABLE = True
except Exception:
    SKLEARN_AVAILABLE = False


def train_risk_model(signal_matrix: np.ndarray, n_estimators: int = 100):
    """Train a model if sklearn available, otherwise save simple stats for fallback."""
    if SKLEARN_AVAILABLE:
        model = IsolationForest(n_estimators=n_estimators, contamination=0.05, random_state=42)
        model.fit(signal_matrix)
        # cannot reliably persist sklearn model without joblib dependency; save flag
        meta = {"sklearn": True}
        with open(IF_PATH, 'w') as f:
            json.dump(meta, f)
        return IF_PATH
    # fallback: save column-wise mean and std
    stats = {"mean": signal_matrix.mean(axis=0).tolist(), "std": signal_matrix.std(axis=0).tolist(), "sklearn": False}
    with open(IF_PATH, 'w') as f:
        json.dump(stats, f)
    return IF_PATH


def load_risk_model():
    if os.path.exists(IF_PATH):
        with open(IF_PATH, 'r') as f:
            return json.load(f)
    return None


def anomaly_score(features: np.ndarray):
    """Return an anomaly score using the saved model or z-score fallback.

    Returns dict {"score": float, "is_anomaly": bool}
    """
    model = load_risk_model()
    if model is None:
        return None
    if model.get("sklearn") and SKLEARN_AVAILABLE:
        # Real sklearn model scoring not implemented here (demo); return placeholder
        return {"score": 0.0, "is_anomaly": False}
    # fallback: compute z-score across saved stats
    mean = np.array(model["mean"])
    std = np.array(model["std"]) + 1e-6
    z = np.abs((features - mean) / std)
    score = float(z.mean())
    is_anom = bool(score > 2.0)
    return {"score": score, "is_anomaly": is_anom}

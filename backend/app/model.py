"""
Insider threat detection engine.

Two signals are blended into a single 0-100 risk score:

1. ISOLATION FOREST (global, unsupervised) — trained across every user-day
   in the feature table. Good at catching combinations of features that are
   jointly weird even if no single one crosses an obvious line. Its raw
   output is converted to a 0-100 percentile so it's comparable day to day.

2. PERSONAL BASELINE DEVIATION (rule-based, per-user) — compares each day
   against that specific user's own historical mean/std (see baseline.py).
   This is what makes explanations concrete ("3.4x your normal login hour
   deviation") and is what keeps the system from flagging a data analyst
   for doing data-analyst things while missing a receptionist who suddenly
   isn't.

The blend + the BASELINE_MIN_DAYS gate (new users get a provisional, capped
score until they have enough history) is the main false-positive control.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

from baseline import NUMERIC_FEATURES, build_user_baselines, zscore, BASELINE_MIN_DAYS

RULE_WEIGHTS = {
    "after_hours_login": 12,
    "failed_logins": 8,
    "distinct_ips": 6,
    "files_accessed": 10,
    "sensitive_files_accessed": 16,
    "files_downloaded": 12,
    "usb_first_time": 18,
    "usb_data_mb": 14,
    "transfer_mb": 10,
    "external_transfer_mb": 20,
}

EXPLANATIONS = {
    "after_hours_login": lambda r, z: f"Login well outside typical hours (earliest login {fmt_hour(r['earliest_login_hour'])}, {z:.1f} std devs from baseline)",
    "failed_logins": lambda r, z: f"{int(r['failed_logins'])} failed login attempt(s) before success — {z:.1f} std devs above normal",
    "distinct_ips": lambda r, z: f"Logged in from {int(r['distinct_ips'])} distinct source IPs in one day",
    "files_accessed": lambda r, z: f"Accessed {int(r['files_accessed'])} files — {z:.1f} std devs above personal daily average",
    "sensitive_files_accessed": lambda r, z: f"Accessed {int(r['sensitive_files_accessed'])} files in sensitive/restricted folders, well above this user's norm",
    "files_downloaded": lambda r, z: f"Downloaded {int(r['files_downloaded'])} files in a single day — {z:.1f} std devs above baseline",
    "usb_first_time": lambda r, z: "First-time use of an unrecognized USB device",
    "usb_data_mb": lambda r, z: f"Wrote {r['usb_data_mb']:.0f} MB to USB storage — far above this user's typical USB volume",
    "transfer_mb": lambda r, z: f"Total data transfer of {r['transfer_mb']:.0f} MB — {z:.1f} std devs above personal baseline",
    "external_transfer_mb": lambda r, z: f"{r['external_transfer_mb']:.0f} MB sent to an external/personal destination (personal email or external cloud storage)",
}


def fmt_hour(h):
    if h is None or (isinstance(h, float) and np.isnan(h)):
        return "n/a"
    hh = int(h)
    mm = int(round((h - hh) * 60))
    return f"{hh:02d}:{mm:02d}"


def train_isolation_forest(df: pd.DataFrame):
    X = df[NUMERIC_FEATURES].fillna(0).values
    model = IsolationForest(
        n_estimators=200,
        contamination=0.06,     # expected proportion of anomalous user-days
        random_state=42,
        max_samples="auto",
    )
    model.fit(X)
    raw_scores = model.decision_function(X)  # higher = more normal
    # Convert to 0-100 "anomaly percentile" where 100 = most anomalous
    ranks = pd.Series(raw_scores).rank(pct=True)
    anomaly_pct = ((1 - ranks) * 100).values
    return model, anomaly_pct


MIN_ABS_DELTA = {
    "after_hours_login": 1,
    "failed_logins": 2,
    "distinct_ips": 2,
    "files_accessed": 10,
    "sensitive_files_accessed": 2,
    "files_downloaded": 6,
    "usb_first_time": 1,
    "usb_data_mb": 80,
    "transfer_mb": 60,
    "external_transfer_mb": 60,
}


def rule_based_score_and_reasons(row, baseline):
    """Returns (rule_score 0-100, list of (feature, z, weight, explanation) reasons)."""
    reasons = []
    total = 0.0
    feats = baseline["features"]

    for feat, weight in RULE_WEIGHTS.items():
        val = row.get(feat) or 0
        mean, std, maxv = feats[feat]["mean"], feats[feat]["std"], feats[feat]["max"]
        z = zscore(val, mean, std)
        delta = val - mean

        # A trigger requires BOTH a statistically meaningful deviation from
        # this user's own baseline AND an absolute delta large enough to
        # matter operationally -- z-score alone is too easily fooled by
        # near-zero-variance features (e.g. someone who never touches
        # sensitive folders has ~0 std, so a single stray access shouldn't
        # look like a 50-sigma event).
        triggered = False
        if feat == "usb_first_time" and val > 0:
            triggered = True
            z = max(z, 3.0)
        elif feat == "after_hours_login" and val > 0 and mean < 0.15:
            # rare-for-this-user binary flag: presence alone is the signal,
            # not a magnitude comparison against a max of 1
            triggered = True
            z = max(z, 2.5)
        elif feat == "external_transfer_mb" and val > max(mean * 2.5, 60) and delta >= MIN_ABS_DELTA[feat]:
            triggered = True
        elif z >= 2.2 and delta >= MIN_ABS_DELTA[feat] and val > maxv * 1.1:
            triggered = True

        if triggered:
            contribution = min(weight * min(z / 2.5, 2.2), weight * 2.2)
            total += contribution
            reasons.append({
                "feature": feat, "z_score": round(float(z), 2),
                "weight": weight, "contribution": round(float(contribution), 1),
                "explanation": EXPLANATIONS[feat](row, z),
            })

    rule_score = min(100.0, total)
    reasons.sort(key=lambda r: -r["contribution"])
    return rule_score, reasons


def severity_from_score(score, baseline_ready):
    if not baseline_ready:
        return "Low"  # provisional — not enough history to trust a higher verdict
    if score >= 80:
        return "Critical"
    if score >= 60:
        return "High"
    if score >= 40:
        return "Medium"
    return "Low"


def run_detection(df: pd.DataFrame) -> pd.DataFrame:
    baselines = build_user_baselines(df)
    _, anomaly_pct = train_isolation_forest(df)
    df = df.copy()
    df["isolation_forest_score"] = anomaly_pct

    risk_scores, severities, reasons_col, baseline_ready_col = [], [], [], []
    for i, row in df.iterrows():
        baseline = baselines[row["user_id"]]
        rule_score, reasons = rule_based_score_and_reasons(row, baseline)
        if_score = row["isolation_forest_score"]

        blended = 0.4 * if_score + 0.6 * rule_score
        if not baseline["baseline_ready"]:
            blended = min(blended, 35)  # cap: thin history -> can't justify a high-confidence alert
        if not reasons:
            # Every Medium+ alert must come with at least one concrete,
            # explainable reason (analyst requirement). A day the Isolation
            # Forest finds statistically odd but that trips no rule at all
            # isn't actionable, so it's held at Low rather than surfaced.
            blended = min(blended, 30)

        risk_scores.append(round(float(blended), 1))
        severities.append(severity_from_score(blended, baseline["baseline_ready"]))
        reasons_col.append(reasons)
        baseline_ready_col.append(baseline["baseline_ready"])

    df["risk_score"] = risk_scores
    df["severity"] = severities
    df["reasons"] = reasons_col
    df["baseline_ready"] = baseline_ready_col
    return df, baselines

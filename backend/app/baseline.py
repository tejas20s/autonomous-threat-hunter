"""
Builds each user's personal behavioral baseline: the mean/std of their own
features over a training window. This is what lets the system say "this is
unusual FOR THIS PERSON" rather than applying one fixed rule to everyone —
an analyst who downloads 40 files a day is normal; a receptionist who
suddenly does the same thing is not.

BASELINE_MIN_DAYS: minimum days of history required before a user's alerts
are trusted (avoids false positives from a thin/incomplete baseline on
someone's first week — a common source of false alarms in real deployments).
"""

import numpy as np
import pandas as pd

BASELINE_TRAIN_DAYS = 30   # first N days per user used to learn "normal"
BASELINE_MIN_DAYS = 10     # minimum days seen before we trust an alert

NUMERIC_FEATURES = [
    "avg_login_hour", "earliest_login_hour", "after_hours_login", "failed_logins",
    "login_count", "distinct_ips", "files_accessed", "sensitive_files_accessed",
    "files_downloaded", "usb_events", "usb_first_time", "usb_data_mb",
    "transfer_mb", "external_transfer_mb",
]


def build_user_baselines(df: pd.DataFrame) -> dict:
    """
    Returns {user_id: {feature: {mean, std, days_seen}}} computed from each
    user's first BASELINE_TRAIN_DAYS calendar days of activity.
    """
    baselines = {}
    for uid, g in df.groupby("user_id"):
        g = g.sort_values("date")
        train = g.head(BASELINE_TRAIN_DAYS)
        stats = {}
        for feat in NUMERIC_FEATURES:
            vals = train[feat].dropna().values
            mean = float(np.mean(vals)) if len(vals) else 0.0
            std = float(np.std(vals)) if len(vals) else 0.0
            maxv = float(np.max(vals)) if len(vals) else 0.0
            std_floor = max(0.15 * mean, 0.1 * maxv, 0.5)
            stats[feat] = {"mean": mean, "std": max(std, std_floor), "max": maxv}
        baselines[uid] = {
            "features": stats,
            "days_seen": int(len(train)),
            "baseline_ready": int(len(train)) >= BASELINE_MIN_DAYS,
        }
    return baselines


def zscore(value, mean, std):
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return 0.0
    return (value - mean) / std

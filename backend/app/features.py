"""
Turns raw event logs into a per-user, per-day feature table.

Each row = one user's behavior on one day. These are the features the
anomaly model learns "normal" ranges for, and later scores against.
"""

import json
from pathlib import Path
from datetime import datetime
import pandas as pd
import numpy as np

DATA_DIR = Path(__file__).parent / "data"


def load_events():
    with open(DATA_DIR / "events.json") as f:
        return json.load(f)


def load_profiles():
    with open(DATA_DIR / "user_profiles.json") as f:
        profiles = json.load(f)
    return {p["user_id"]: p for p in profiles}


def build_feature_table():
    events = load_events()
    profiles = load_profiles()

    rows = {}  # (user_id, date) -> feature dict

    def get_row(user_id, date):
        key = (user_id, date)
        if key not in rows:
            rows[key] = {
                "user_id": user_id, "date": date,
                "login_hours": [], "failed_logins": 0, "login_count": 0,
                "files_accessed": 0, "sensitive_files_accessed": 0, "files_downloaded": 0,
                "usb_events": 0, "usb_first_time": 0, "usb_data_mb": 0.0,
                "transfer_mb": 0.0, "external_transfer_mb": 0.0,
                "distinct_source_ips": set(),
            }
        return rows[key]

    for e in events:
        ts = datetime.fromisoformat(e["timestamp"])
        date = ts.date().isoformat()
        uid = e["user_id"]
        row = get_row(uid, date)

        if e["event_type"] == "login":
            row["login_count"] += 1
            row["distinct_source_ips"].add(e["source_ip"])
            if e["result"] == "failed":
                row["failed_logins"] += 1
            else:
                row["login_hours"].append(ts.hour + ts.minute / 60)

        elif e["event_type"] == "file_access":
            row["files_accessed"] += 1
            if e["sensitive"]:
                row["sensitive_files_accessed"] += 1
            if e["action"] == "download":
                row["files_downloaded"] += 1

        elif e["event_type"] == "usb":
            row["usb_events"] += 1
            if e["first_time_device"]:
                row["usb_first_time"] += 1
            row["usb_data_mb"] += e["data_written_mb"]

        elif e["event_type"] == "data_transfer":
            row["transfer_mb"] += e["bytes_mb"]
            if e["destination"] in ("personal-email-domain", "external-cloud-storage"):
                row["external_transfer_mb"] += e["bytes_mb"]

    out = []
    for (uid, date), r in rows.items():
        weekday = datetime.fromisoformat(date).weekday()
        login_hour = np.mean(r["login_hours"]) if r["login_hours"] else np.nan
        earliest_hour = min(r["login_hours"]) if r["login_hours"] else np.nan
        after_hours = 1 if (r["login_hours"] and (min(r["login_hours"]) < 6 or min(r["login_hours"]) > 20)) else 0
        out.append({
            "user_id": uid, "date": date, "weekday": weekday, "is_weekend": int(weekday >= 5),
            "avg_login_hour": login_hour, "earliest_login_hour": earliest_hour,
            "after_hours_login": after_hours, "failed_logins": r["failed_logins"],
            "login_count": r["login_count"], "distinct_ips": len(r["distinct_source_ips"]),
            "files_accessed": r["files_accessed"], "sensitive_files_accessed": r["sensitive_files_accessed"],
            "files_downloaded": r["files_downloaded"],
            "usb_events": r["usb_events"], "usb_first_time": r["usb_first_time"], "usb_data_mb": r["usb_data_mb"],
            "transfer_mb": r["transfer_mb"], "external_transfer_mb": r["external_transfer_mb"],
            "department": profiles.get(uid, {}).get("department", "Unknown"),
        })

    df = pd.DataFrame(out).sort_values(["user_id", "date"]).reset_index(drop=True)
    return df


if __name__ == "__main__":
    df = build_feature_table()
    df.to_csv(DATA_DIR / "features.csv", index=False)
    print(f"Built feature table: {df.shape[0]} user-days x {df.shape[1]} columns")
    print(df.head())

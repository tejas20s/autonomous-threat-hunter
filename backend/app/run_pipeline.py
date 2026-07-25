"""
Runs the full pipeline end to end: generate logs -> features -> baselines +
Isolation Forest -> risk scores -> alerts/timeline/summary — and writes
everything to the database AND JSON output files for backward compatibility.

Usage:
    python run_pipeline.py
"""

import asyncio
import json
from pathlib import Path
import pandas as pd
import numpy as np

import generator
import features as feat_mod
from model import run_detection
from database import engine, async_session_factory
from models import Base, UserProfile, RawEvent, BehavioralBaseline, DailyFeature, Alert, DailyTimeline
from sqlalchemy import select, delete

DATA_DIR = Path(__file__).parent / "data"
OUT_DIR = Path(__file__).parent.parent / "output"

ALERT_THRESHOLD = 40  # only Medium+ becomes a surfaced "alert"


def to_native(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return float(o)
    if isinstance(o, (np.bool_,)):
        return bool(o)
    return o


async def init_db():
    """Drop and recreate all tables for a clean schema."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("  ✓ Database tables ready (fresh schema)")


async def store_profiles(session, profiles):
    for p in profiles:
        result = await session.execute(
            select(UserProfile).where(UserProfile.user_id == p["user_id"])
        )
        existing = result.scalar_one_or_none()
        if not existing:
            session.add(UserProfile(
                user_id=p["user_id"],
                department=p["department"],
                known_usb_devices=p.get("known_usb_devices", []),
                sensitive_access_normal=p.get("sensitive_access_normal", False),
            ))
    await session.commit()
    print(f"  ✓ Stored {len(profiles)} user profiles")


async def store_events(session, events):
    batch = []
    for e in events:
        ts = e.get("timestamp")
        if isinstance(ts, str):
            from datetime import datetime
            ts = datetime.fromisoformat(ts)
        meta = {k: v for k, v in e.items() if k not in ("event_type", "user_id", "timestamp")}
        batch.append(RawEvent(
            event_type=e["event_type"],
            user_id=e["user_id"],
            timestamp=ts,
            metadata_json=meta,
        ))
        if len(batch) >= 500:
            session.add_all(batch)
            await session.flush()
            batch = []
    if batch:
        session.add_all(batch)
    await session.commit()
    print(f"  ✓ Stored {len(events)} events")


async def clear_existing_data(session, user_ids: list, dates: list):
    """Clear existing data for the users/dates we're about to re-insert."""
    # Delete daily features for these users
    await session.execute(
        delete(DailyFeature).where(DailyFeature.user_id.in_(user_ids))
    )
    # Delete timelines for these users
    await session.execute(
        delete(DailyTimeline).where(DailyTimeline.user_id.in_(user_ids))
    )
    # Delete all alerts (they'll be regenerated)
    await session.execute(delete(Alert))
    await session.commit()


async def store_features_and_baselines(session, df, baselines):
    # Store baselines
    for uid, bl in baselines.items():
        result = await session.execute(
            select(BehavioralBaseline).where(BehavioralBaseline.user_id == uid)
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.features_json = bl["features"]
            existing.baseline_ready = bl["baseline_ready"]
            existing.days_seen = bl["days_seen"]
        else:
            session.add(BehavioralBaseline(
                user_id=uid,
                features_json=bl["features"],
                baseline_ready=bl["baseline_ready"],
                days_seen=bl["days_seen"],
            ))
    await session.flush()

    # Store daily features
    for _, row in df.iterrows():
        feat = DailyFeature(
            user_id=row["user_id"],
            date=row["date"],
            weekday=int(row["weekday"]) if not pd.isna(row.get("weekday")) else 0,
            is_weekend=int(row["is_weekend"]) if not pd.isna(row.get("is_weekend")) else 0,
            avg_login_hour=None if pd.isna(row.get("avg_login_hour")) else round(float(row["avg_login_hour"]), 2),
            earliest_login_hour=None if pd.isna(row.get("earliest_login_hour")) else round(float(row["earliest_login_hour"]), 2),
            after_hours_login=int(row["after_hours_login"]),
            failed_logins=int(row["failed_logins"]),
            login_count=int(row["login_count"]),
            distinct_ips=int(row["distinct_ips"]),
            files_accessed=int(row["files_accessed"]),
            sensitive_files_accessed=int(row["sensitive_files_accessed"]),
            files_downloaded=int(row["files_downloaded"]),
            usb_events=int(row["usb_events"]),
            usb_first_time=int(row["usb_first_time"]),
            usb_data_mb=round(float(row["usb_data_mb"]), 1),
            transfer_mb=round(float(row["transfer_mb"]), 1),
            external_transfer_mb=round(float(row["external_transfer_mb"]), 1),
            department=str(row.get("department", "Unknown")),
            isolation_forest_score=round(float(row.get("isolation_forest_score", 0)), 1),
            risk_score=round(float(row.get("risk_score", 0)), 1),
            severity=str(row.get("severity", "Low")),
            baseline_ready=bool(row.get("baseline_ready", False)),
            reasons_json=row.get("reasons", []),
        )
        session.add(feat)
    await session.commit()
    print(f"  ✓ Stored {len(df)} daily feature rows + baselines")


async def store_alerts_and_timelines(session, scored_df, alerts, timelines):
    # Store alerts
    for a in alerts:
        session.add(Alert(
            alert_id=a["alert_id"],
            user_id=a["user_id"],
            department=a["department"],
            date=a["date"],
            risk_score=a["risk_score"],
            severity=a["severity"],
            isolation_forest_score=a.get("isolation_forest_score", 0),
            baseline_ready=a.get("baseline_ready", False),
            reasons=a.get("reasons", []),
            evidence=a.get("evidence", {}),
        ))
    # Store timelines
    for uid, days in timelines.items():
        for d in days:
            session.add(DailyTimeline(
                user_id=uid,
                date=d["date"],
                risk_score=d["risk_score"],
                severity=d["severity"],
                files_accessed=d["files_accessed"],
                sensitive_files_accessed=d["sensitive_files_accessed"],
                usb_events=d["usb_events"],
                transfer_mb=d["transfer_mb"],
                after_hours_login=d["after_hours_login"],
            ))
    await session.commit()
    print(f"  ✓ Stored {len(alerts)} alerts + timelines for {len(timelines)} users")


async def main_async():
    print("1/6  Initializing database...")
    await init_db()

    print("2/6  Generating simulated logs...")
    generator.main()

    # Reload profiles & events from JSON (generator wrote them)
    with open(DATA_DIR / "user_profiles.json") as f:
        profiles = json.load(f)
    with open(DATA_DIR / "events.json") as f:
        events = json.load(f)

    async with async_session_factory() as session:
        await store_profiles(session, profiles)

    print("3/6  Building feature table...")
    df = feat_mod.build_feature_table()

    print("4/6  Training Isolation Forest + scoring against personal baselines...")
    scored_df, baselines = run_detection(df)

    # Clear existing data before re-inserting (allows safe re-runs)
    user_ids = scored_df["user_id"].unique().tolist()
    dates = scored_df["date"].unique().tolist()
    async with async_session_factory() as session:
        await clear_existing_data(session, user_ids, dates)

    async with async_session_factory() as session:
        await store_features_and_baselines(session, scored_df, baselines)

    print("5/6  Assembling alerts, timelines, and dashboard summary...")
    OUT_DIR.mkdir(exist_ok=True)

    alerts = []
    alert_id = 1
    for _, row in scored_df.iterrows():
        if row["risk_score"] < ALERT_THRESHOLD:
            continue
        alerts.append({
            "alert_id": f"ALT-{alert_id:04d}",
            "user_id": row["user_id"],
            "department": row["department"],
            "date": row["date"],
            "risk_score": to_native(row["risk_score"]),
            "severity": row["severity"],
            "isolation_forest_score": round(to_native(row["isolation_forest_score"]), 1),
            "baseline_ready": bool(row["baseline_ready"]),
            "reasons": row["reasons"],
            "evidence": {
                "avg_login_hour": None if pd.isna(row["avg_login_hour"]) else round(to_native(row["avg_login_hour"]), 2),
                "earliest_login_hour": None if pd.isna(row["earliest_login_hour"]) else round(to_native(row["earliest_login_hour"]), 2),
                "failed_logins": to_native(row["failed_logins"]),
                "files_accessed": to_native(row["files_accessed"]),
                "sensitive_files_accessed": to_native(row["sensitive_files_accessed"]),
                "files_downloaded": to_native(row["files_downloaded"]),
                "usb_events": to_native(row["usb_events"]),
                "usb_first_time": to_native(row["usb_first_time"]),
                "usb_data_mb": round(to_native(row["usb_data_mb"]), 1),
                "transfer_mb": round(to_native(row["transfer_mb"]), 1),
                "external_transfer_mb": round(to_native(row["external_transfer_mb"]), 1),
            },
        })
        alert_id += 1

    alerts.sort(key=lambda a: -a["risk_score"])

    # Per-user full daily timeline
    timelines = {}
    for uid, g in scored_df.groupby("user_id"):
        g = g.sort_values("date")
        timelines[uid] = [
            {
                "date": r["date"], "risk_score": to_native(r["risk_score"]),
                "severity": r["severity"],
                "files_accessed": to_native(r["files_accessed"]),
                "sensitive_files_accessed": to_native(r["sensitive_files_accessed"]),
                "usb_events": to_native(r["usb_events"]),
                "transfer_mb": round(to_native(r["transfer_mb"]), 1),
                "after_hours_login": to_native(r["after_hours_login"]),
            }
            for _, r in g.iterrows()
        ]

    sev_counts = scored_df["severity"].value_counts().to_dict()
    with open(DATA_DIR / "ground_truth.json") as f:
        ground_truth = json.load(f)
    gt_keys = {(g["user_id"], g["date"]) for g in ground_truth}
    caught = sum(1 for a in alerts if (a["user_id"], a["date"]) in gt_keys and a["severity"] in ("High", "Critical"))

    summary = {
        "total_user_days_analyzed": int(len(scored_df)),
        "total_alerts": len(alerts),
        "severity_counts": {k: int(v) for k, v in sev_counts.items()},
        "users_monitored": int(scored_df["user_id"].nunique()),
        "days_covered": int(scored_df["date"].nunique()),
        "injected_scenarios": len(ground_truth),
        "injected_scenarios_caught_high_or_critical": caught,
    }

    # Write JSON outputs (backward compat)
    with open(OUT_DIR / "alerts.json", "w") as f:
        json.dump(alerts, f, indent=2)
    with open(OUT_DIR / "timelines.json", "w") as f:
        json.dump(timelines, f, indent=2)
    with open(OUT_DIR / "summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    # Store in database
    async with async_session_factory() as session:
        await store_alerts_and_timelines(session, scored_df, alerts, timelines)

    print(f"\n6/6  Done. {len(alerts)} alerts surfaced out of {len(scored_df)} user-days analyzed.")
    print(f"Severity breakdown: {sev_counts}")
    print(f"Ground-truth injected scenarios caught at High/Critical: {caught}/{len(ground_truth)}")
    print(f"Data written to DB + {OUT_DIR}")


def main():
    asyncio.run(main_async())


if __name__ == "__main__":
    main()

"""
Attack Simulator — generates malicious events on-the-fly and runs them
through the detection pipeline to produce real-time alerts.

This is the interactive demo feature that lets judges click a button
and watch an insider threat attack happen in real time.
"""

import random
import json
from datetime import datetime, timedelta
from typing import Optional
from pathlib import Path

import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session_factory
from models import BehavioralBaseline, Alert, DailyTimeline, DailyFeature, UserProfile
from baseline import NUMERIC_FEATURES, zscore
from model import rule_based_score_and_reasons, severity_from_score, RULE_WEIGHTS, EXPLANATIONS
from mitre_attack import get_primary_technique
from notifications import notify_alert
from websocket_manager import notify_new_alert

DATA_DIR = Path(__file__).parent / "data"

# Load user profiles once
with open(DATA_DIR / "user_profiles.json") as f:
    _profiles_list = json.load(f)
USER_PROFILES = {p["user_id"]: p for p in _profiles_list}
USER_IDS = list(USER_PROFILES.keys())

SENSITIVE_FOLDERS = [
    "/finance/payroll", "/finance/audit", "/hr/employee_records",
    "/legal/contracts", "/engineering/source_core", "/exec/board_minutes",
]

ATTACK_SCENARIOS = {
    "login_attack": {
        "name": "Login Attack",
        "description": "Simulates brute-force login attempts from multiple IPs at unusual hours",
        "icon": "🔐",
        "mitre_id": "T1110",
        "mitre_name": "Brute Force",
        "tactic": "Credential Access",
    },
    "usb_attack": {
        "name": "USB Exfiltration",
        "description": "Simulates an employee plugging in an unknown USB device and copying large volumes of data",
        "icon": "💾",
        "mitre_id": "T1052",
        "mitre_name": "Exfiltration Over Physical Medium",
        "tactic": "Exfiltration",
    },
    "data_exfiltration": {
        "name": "Data Exfiltration",
        "description": "Simulates large data transfer to external/personal cloud storage or email",
        "icon": "📤",
        "mitre_id": "T1567",
        "mitre_name": "Exfiltration Over Web Service",
        "tactic": "Exfiltration",
    },
    "sensitive_access": {
        "name": "Sensitive Folder Access",
        "description": "Simulates an employee accessing sensitive files they don't normally touch",
        "icon": "📁",
        "mitre_id": "T1213",
        "mitre_name": "Data from Information Repositories",
        "tactic": "Collection",
    },
    "combined": {
        "name": "Combined Insider Attack",
        "description": "Simulates a coordinated multi-vector insider threat: off-hours login + sensitive access + USB + exfiltration",
        "icon": "🚨",
        "mitre_id": "T1078",
        "mitre_name": "Valid Accounts (Combined)",
        "tactic": "Multiple Tactics",
    },
}


def _pick_random_user(exclude: Optional[str] = None) -> str:
    """Pick a random user, optionally excluding one."""
    candidates = [u for u in USER_IDS if u != exclude]
    return random.choice(candidates) if candidates else random.choice(USER_IDS)


def _generate_events(attack_type: str, user_id: str) -> list[dict]:
    """Generate malicious events for a given attack type."""
    now = datetime.utcnow()
    today = now.date()
    events = []

    user_profile = USER_PROFILES.get(user_id, {"department": "Unknown", "sensitive_access_normal": False})
    dept = user_profile.get("department", "Unknown")
    sensitive_normal = user_profile.get("sensitive_access_normal", False)

    if attack_type in ("login_attack", "combined"):
        # Off-hours failed logins from multiple IPs
        hour = random.choice([1.5, 2.3, 3.0, 23.5, 23.8])
        for i in range(random.randint(3, 6)):
            ts = now - timedelta(hours=2) + timedelta(minutes=i * 3)
            events.append({
                "event_type": "login", "user_id": user_id,
                "timestamp": ts.isoformat(), "result": "failed",
                "source_ip": f"{random.choice(['185', '45', '91'])}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}",
            })
        # One success at weird hour
        ts = now - timedelta(hours=1)
        events.append({
            "event_type": "login", "user_id": user_id,
            "timestamp": ts.isoformat(), "result": "success",
            "source_ip": f"10.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}",
        })

    if attack_type in ("sensitive_access", "combined"):
        # Mass sensitive file access
        n_files = random.randint(15, 50)
        for _ in range(n_files):
            folder = random.choice(SENSITIVE_FOLDERS)
            ts = now - timedelta(minutes=random.randint(0, 120))
            events.append({
                "event_type": "file_access", "user_id": user_id,
                "timestamp": ts.isoformat(),
                "file_path": f"{folder}/{random.randint(1000,9999)}.doc",
                "sensitive": True,
                "action": random.choice(["view", "download"]),
            })

    if attack_type in ("usb_attack", "combined"):
        # First-time USB device with large data
        device = f"USB-{random.randint(9000, 9999)}"
        data_mb = random.uniform(300, 1500)
        ts = now - timedelta(minutes=random.randint(0, 60))
        events.append({
            "event_type": "usb", "user_id": user_id,
            "timestamp": ts.isoformat(),
            "device_id": device, "first_time_device": True,
            "data_written_mb": round(data_mb, 1),
        })

    if attack_type in ("data_exfiltration", "combined"):
        # Large external transfer
        mb = random.uniform(800, 3500)
        dest = random.choice(["personal-email-domain", "external-cloud-storage"])
        ts = now - timedelta(minutes=random.randint(0, 30))
        events.append({
            "event_type": "data_transfer", "user_id": user_id,
            "timestamp": ts.isoformat(),
            "destination": dest, "bytes_mb": round(mb, 1),
        })

    return events


def _extract_features(events: list[dict], user_id: str) -> dict:
    """Extract behavioral features from a list of events (same logic as features.py)."""
    today = datetime.utcnow().date().isoformat()
    feature_row = {
        "user_id": user_id, "date": today,
        "login_hours": [], "failed_logins": 0, "login_count": 0,
        "files_accessed": 0, "sensitive_files_accessed": 0, "files_downloaded": 0,
        "usb_events": 0, "usb_first_time": 0, "usb_data_mb": 0.0,
        "transfer_mb": 0.0, "external_transfer_mb": 0.0,
        "distinct_source_ips": set(),
    }

    for e in events:
        ts = datetime.fromisoformat(e["timestamp"])
        if e["event_type"] == "login":
            feature_row["login_count"] += 1
            feature_row["distinct_source_ips"].add(e.get("source_ip", ""))
            if e["result"] == "failed":
                feature_row["failed_logins"] += 1
            else:
                feature_row["login_hours"].append(ts.hour + ts.minute / 60)
        elif e["event_type"] == "file_access":
            feature_row["files_accessed"] += 1
            if e.get("sensitive"):
                feature_row["sensitive_files_accessed"] += 1
            if e.get("action") == "download":
                feature_row["files_downloaded"] += 1
        elif e["event_type"] == "usb":
            feature_row["usb_events"] += 1
            if e.get("first_time_device"):
                feature_row["usb_first_time"] += 1
            feature_row["usb_data_mb"] += e.get("data_written_mb", 0)
        elif e["event_type"] == "data_transfer":
            feature_row["transfer_mb"] += e.get("bytes_mb", 0)
            if e.get("destination") in ("personal-email-domain", "external-cloud-storage"):
                feature_row["external_transfer_mb"] += e.get("bytes_mb", 0)

    login_hour = np.mean(feature_row["login_hours"]) if feature_row["login_hours"] else np.nan
    earliest_hour = min(feature_row["login_hours"]) if feature_row["login_hours"] else np.nan
    after_hours = 1 if (feature_row["login_hours"] and (min(feature_row["login_hours"]) < 6 or min(feature_row["login_hours"]) > 20)) else 0

    return {
        "user_id": user_id,
        "date": today,
        "avg_login_hour": login_hour,
        "earliest_login_hour": earliest_hour,
        "after_hours_login": after_hours,
        "failed_logins": feature_row["failed_logins"],
        "login_count": feature_row["login_count"],
        "distinct_ips": len(feature_row["distinct_source_ips"]),
        "files_accessed": feature_row["files_accessed"],
        "sensitive_files_accessed": feature_row["sensitive_files_accessed"],
        "files_downloaded": feature_row["files_downloaded"],
        "usb_events": feature_row["usb_events"],
        "usb_first_time": feature_row["usb_first_time"],
        "usb_data_mb": feature_row["usb_data_mb"],
        "transfer_mb": feature_row["transfer_mb"],
        "external_transfer_mb": feature_row["external_transfer_mb"],
        "department": USER_PROFILES.get(user_id, {}).get("department", "Unknown"),
    }


async def _get_baseline(user_id: str) -> Optional[dict]:
    """Get the stored behavioral baseline for a user."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(BehavioralBaseline).where(BehavioralBaseline.user_id == user_id)
        )
        bl = result.scalar_one_or_none()
        if bl and bl.features_json:
            return {
                "features": bl.features_json,
                "baseline_ready": bl.baseline_ready,
                "days_seen": bl.days_seen,
            }
    return None


async def simulate_attack(
    attack_type: str,
    user_id: Optional[str] = None,
) -> dict:
    """
    Simulate an attack and return the generated alert.

    Steps:
    1. Pick a random user (or use specified one)
    2. Generate malicious events
    3. Extract features from events
    4. Score against user's existing baseline
    5. Create alert with MITRE ATT&CK info
    6. Store in database
    7. Broadcast via SSE
    8. Return the alert
    """
    if attack_type not in ATTACK_SCENARIOS:
        return {"error": f"Unknown attack type: {attack_type}. Choose from: {list(ATTACK_SCENARIOS.keys())}"}

    # 1. Pick user
    if not user_id:
        user_id = _pick_random_user()
    if user_id not in USER_PROFILES:
        return {"error": f"Unknown user: {user_id}"}

    scenario = ATTACK_SCENARIOS[attack_type]
    dept = USER_PROFILES[user_id].get("department", "Unknown")

    # 2. Generate events
    events = _generate_events(attack_type, user_id)

    # 3. Extract features
    feature_row = _extract_features(events, user_id)

    # 4. Score against baseline
    baseline = await _get_baseline(user_id)
    if baseline:
        rule_score, reasons = rule_based_score_and_reasons(feature_row, baseline)
        baseline_ready = baseline["baseline_ready"]
    else:
        reasons = [{"feature": "no_baseline", "z_score": 0, "weight": 0, "contribution": 0,
                     "explanation": "No behavioral baseline exists for this user yet. Run the pipeline first."}]
        rule_score = 0
        baseline_ready = False

    # Simulate Isolation Forest score (high for obvious attacks)
    if_score = random.uniform(50, 99)
    blended = 0.4 * if_score + 0.6 * rule_score

    if not baseline_ready:
        blended = min(blended, 35)
    if not reasons:
        blended = min(blended, 30)

    risk_score = round(float(blended), 1)
    severity = severity_from_score(risk_score, baseline_ready)

    # Get MITRE info
    mitre = get_primary_technique(reasons) or {
        "technique_id": scenario["mitre_id"],
        "technique_name": scenario["mitre_name"],
        "tactic": scenario["tactic"],
    }

    # 5. Build alert
    today = datetime.utcnow().date().isoformat()

    alert_data = {
        "alert_id": f"SIM-{random.randint(1000, 9999)}",
        "user_id": user_id,
        "department": dept,
        "date": today,
        "risk_score": risk_score,
        "severity": severity,
        "isolation_forest_score": round(if_score, 1),
        "baseline_ready": baseline_ready,
        "reasons": reasons,
        "evidence": {
            key: feature_row.get(key, 0)
            for key in ["avg_login_hour", "earliest_login_hour", "failed_logins",
                         "files_accessed", "sensitive_files_accessed", "files_downloaded",
                         "usb_events", "usb_first_time", "usb_data_mb",
                         "transfer_mb", "external_transfer_mb"]
        },
        "mitre_technique_id": mitre["technique_id"],
        "mitre_technique_name": mitre["technique_name"],
        "mitre_tactic": mitre["tactic"],
        "status": "Open",
        "simulated": True,
        "events_count": len(events),
        "attack_type": attack_type,
        "attack_name": scenario["name"],
        "attack_icon": scenario["icon"],
        "event_samples": events[:10],  # First 10 events as samples
        "created_at": datetime.utcnow().isoformat(),
    }

    # 6. Store in database
    async with async_session_factory() as session:
        alert_record = Alert(
            alert_id=alert_data["alert_id"],
            user_id=user_id,
            department=dept,
            date=today,
            risk_score=risk_score,
            severity=severity,
            isolation_forest_score=round(if_score, 1),
            baseline_ready=baseline_ready,
            reasons=reasons,
            evidence=alert_data["evidence"],
            mitre_technique_id=mitre["technique_id"],
            mitre_technique_name=mitre["technique_name"],
            mitre_tactic=mitre["tactic"],
            status="Open",
        )
        session.add(alert_record)

        # Also store feature row
        feat = DailyFeature(
            user_id=user_id,
            date=today,
            department=dept,
            avg_login_hour=None if np.isnan(feature_row["avg_login_hour"]) else round(feature_row["avg_login_hour"], 2),
            earliest_login_hour=None if np.isnan(feature_row["earliest_login_hour"]) else round(feature_row["earliest_login_hour"], 2),
            after_hours_login=feature_row["after_hours_login"],
            failed_logins=feature_row["failed_logins"],
            login_count=feature_row["login_count"],
            distinct_ips=feature_row["distinct_ips"],
            files_accessed=feature_row["files_accessed"],
            sensitive_files_accessed=feature_row["sensitive_files_accessed"],
            files_downloaded=feature_row["files_downloaded"],
            usb_events=feature_row["usb_events"],
            usb_first_time=feature_row["usb_first_time"],
            usb_data_mb=feature_row["usb_data_mb"],
            transfer_mb=feature_row["transfer_mb"],
            external_transfer_mb=feature_row["external_transfer_mb"],
            isolation_forest_score=round(if_score, 1),
            risk_score=risk_score,
            severity=severity,
            baseline_ready=baseline_ready,
            reasons_json=reasons,
        )
        session.add(feat)

        # Update or create timeline entry
        result = await session.execute(
            select(DailyTimeline).where(
                DailyTimeline.user_id == user_id,
                DailyTimeline.date == today,
            )
        )
        existing_tl = result.scalar_one_or_none()
        if existing_tl:
            existing_tl.risk_score = risk_score
            existing_tl.severity = severity
            existing_tl.files_accessed = feature_row["files_accessed"]
            existing_tl.sensitive_files_accessed = feature_row["sensitive_files_accessed"]
            existing_tl.usb_events = feature_row["usb_events"]
            existing_tl.transfer_mb = feature_row["transfer_mb"]
            existing_tl.after_hours_login = feature_row["after_hours_login"]
            existing_tl.failed_logins = feature_row["failed_logins"]
            existing_tl.distinct_ips = feature_row["distinct_ips"]
        else:
            session.add(DailyTimeline(
                user_id=user_id, date=today,
                risk_score=risk_score, severity=severity,
                files_accessed=feature_row["files_accessed"],
                sensitive_files_accessed=feature_row["sensitive_files_accessed"],
                usb_events=feature_row["usb_events"],
                transfer_mb=feature_row["transfer_mb"],
                after_hours_login=feature_row["after_hours_login"],
                failed_logins=feature_row["failed_logins"],
                distinct_ips=feature_row["distinct_ips"],
            ))

        await session.commit()

    # 7. Broadcast via SSE
    await notify_new_alert(alert_data)

    # 8. Try to send notifications (silently fail)
    try:
        await notify_alert(alert_data)
    except Exception:
        pass

    return alert_data


def list_attack_scenarios() -> dict:
    """Return all available attack scenarios."""
    return {
        attack_type: {
            "name": info["name"],
            "description": info["description"],
            "icon": info["icon"],
            "mitre_id": info["mitre_id"],
            "mitre_name": info["mitre_name"],
            "tactic": info["tactic"],
        }
        for attack_type, info in ATTACK_SCENARIOS.items()
    }

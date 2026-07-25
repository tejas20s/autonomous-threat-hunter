"""
Simulated organization log generator.

Produces synthetic, event-level logs across four channels:
  - login events        (timestamp, geo/device, success/failure)
  - file access events  (file path, sensitivity, action)
  - USB events          (device id, first-time flag, data written)
  - data transfer events (destination, bytes, protocol)

Each user gets a stable "behavioral profile" (typical login hour, typical
department folders, typical daily file/data volume). Most days are sampled
tightly around that profile ("normal"). A small number of days for a small
number of users are deliberately pushed off-profile to simulate real
insider-threat patterns (data staging before resignation, off-hours
snooping, USB exfiltration, privilege misuse). These injected days are
NOT labeled in the output — the detector has to find them, same as a real
deployment — but we keep a ground-truth file on the side for evaluation.
"""

import json
import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta, time
from pathlib import Path

random.seed(42)

DEPARTMENTS = ["Engineering", "Finance", "HR", "Sales", "Legal", "IT Ops"]

SENSITIVE_FOLDERS = [
    "/finance/payroll", "/finance/audit", "/hr/employee_records",
    "/legal/contracts", "/engineering/source_core", "/exec/board_minutes",
]
NORMAL_FOLDERS = [
    "/shared/templates", "/engineering/docs", "/sales/leads",
    "/marketing/assets", "/it/tickets", "/general/announcements",
    "/hr/policies_public", "/finance/expense_reports",
]

USB_DEVICE_POOL = [f"USB-{i:04d}" for i in range(1, 40)]

NUM_USERS = 26
NUM_DAYS = 60
START_DATE = datetime(2026, 5, 1)


@dataclass
class UserProfile:
    user_id: str
    department: str
    typical_login_hour: float      # mean hour, 24h clock
    login_hour_std: float
    typical_files_per_day: float
    sensitive_access_normal: bool  # whether role legitimately touches sensitive folders
    known_usb_devices: list = field(default_factory=list)
    typical_transfer_mb: float = 40.0


def build_user_profiles():
    profiles = []
    for i in range(1, NUM_USERS + 1):
        dept = random.choice(DEPARTMENTS)
        uid = f"user{i:03d}"
        typical_hour = random.gauss(9.5, 1.0)
        typical_hour = min(max(typical_hour, 7.5), 11.0)
        profile = UserProfile(
            user_id=uid,
            department=dept,
            typical_login_hour=typical_hour,
            login_hour_std=random.uniform(0.4, 0.9),
            typical_files_per_day=random.uniform(8, 22),
            sensitive_access_normal=dept in ("Finance", "HR", "Legal"),
            known_usb_devices=random.sample(USB_DEVICE_POOL, k=random.choice([0, 1, 1, 2])),
            typical_transfer_mb=random.uniform(15, 80),
        )
        profiles.append(profile)
    return profiles


def pick_anomaly_calendar(profiles):
    """
    Choose a handful of (user, day, scenario) injections spread across the
    back half of the simulation window (so there's baseline history first).
    """
    scenario_pool = [
        "mass_download_pre_exit",
        "off_hours_access",
        "usb_exfiltration",
        "sensitive_snooping",
        "large_data_transfer",
        "combo_high_risk",
    ]
    injections = []
    chosen_users = random.sample(profiles, k=7)
    for user, scenario in zip(chosen_users, random.choices(scenario_pool, k=7)):
        day_offset = random.randint(35, NUM_DAYS - 3)
        injections.append((user.user_id, day_offset, scenario))
    return injections


def gen_login_events(user, day_date, anomaly=None):
    events = []
    is_weekend = day_date.weekday() >= 5
    if is_weekend and anomaly not in ("off_hours_access", "combo_high_risk", "mass_download_pre_exit"):
        if random.random() > 0.06:
            return events  # most users don't work weekends

    if anomaly in ("off_hours_access", "combo_high_risk"):
        hour = random.choice([1.5, 2.3, 3.1, 23.5, 0.5])
    else:
        hour = random.gauss(user.typical_login_hour, user.login_hour_std)
        hour = min(max(hour, 6.0), 20.0)

    ts = day_date + timedelta(hours=hour)
    failed_attempts = 0
    if anomaly == "combo_high_risk" and random.random() < 0.5:
        failed_attempts = random.randint(2, 4)
    for _ in range(failed_attempts):
        events.append({
            "event_type": "login", "user_id": user.user_id,
            "timestamp": ts.isoformat(), "result": "failed",
            "source_ip": f"10.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}",
        })
        ts += timedelta(minutes=1)
    events.append({
        "event_type": "login", "user_id": user.user_id,
        "timestamp": ts.isoformat(), "result": "success",
        "source_ip": f"10.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}",
    })
    return events


def gen_file_events(user, day_date, anomaly=None):
    events = []
    n_files = max(0, int(random.gauss(user.typical_files_per_day, 4)))

    if anomaly == "mass_download_pre_exit":
        n_files = random.randint(60, 140)
    elif anomaly == "combo_high_risk":
        n_files = random.randint(40, 90)
    elif anomaly == "sensitive_snooping":
        n_files = max(n_files, random.randint(15, 30))

    for _ in range(n_files):
        if anomaly in ("sensitive_snooping", "mass_download_pre_exit", "combo_high_risk"):
            folder = random.choice(SENSITIVE_FOLDERS)
        elif user.sensitive_access_normal and random.random() < 0.25:
            folder = random.choice(SENSITIVE_FOLDERS)
        else:
            folder = random.choice(NORMAL_FOLDERS)

        hour_base = user.typical_login_hour if anomaly not in ("off_hours_access", "combo_high_risk") else random.choice([1.5, 2.3, 23.0])
        ts = day_date + timedelta(hours=random.gauss(hour_base + 1, 2))
        action = random.choices(["view", "download", "edit"], weights=[0.5, 0.3, 0.2])[0]
        if anomaly in ("mass_download_pre_exit", "combo_high_risk"):
            action = "download"
        events.append({
            "event_type": "file_access", "user_id": user.user_id,
            "timestamp": ts.isoformat(), "file_path": f"{folder}/{random.randint(1000,9999)}.doc",
            "sensitive": folder in SENSITIVE_FOLDERS, "action": action,
        })
    return events


def gen_usb_events(user, day_date, anomaly=None):
    events = []
    use_usb = random.random() < 0.05
    device = None
    first_time = False

    if anomaly in ("usb_exfiltration", "combo_high_risk"):
        use_usb = True
        device = f"USB-{random.randint(9000, 9999)}"
        first_time = True
    elif use_usb:
        if user.known_usb_devices and random.random() < 0.85:
            device = random.choice(user.known_usb_devices)
            first_time = False
        else:
            device = random.choice(USB_DEVICE_POOL)
            first_time = device not in user.known_usb_devices

    if device:
        data_mb = random.uniform(5, 40)
        if anomaly in ("usb_exfiltration", "combo_high_risk"):
            data_mb = random.uniform(300, 1200)
        hour_base = user.typical_login_hour if anomaly not in ("off_hours_access", "combo_high_risk", "usb_exfiltration") else random.choice([1.0, 22.5, 23.8])
        ts = day_date + timedelta(hours=random.gauss(hour_base + 2, 1.5))
        events.append({
            "event_type": "usb", "user_id": user.user_id, "timestamp": ts.isoformat(),
            "device_id": device, "first_time_device": first_time, "data_written_mb": round(data_mb, 1),
        })
    return events


def gen_transfer_events(user, day_date, anomaly=None):
    events = []
    mb = max(1.0, random.gauss(user.typical_transfer_mb, 15))
    if anomaly in ("large_data_transfer", "combo_high_risk"):
        mb = random.uniform(800, 3500)
    dest = random.choices(
        ["internal-fileshare", "corporate-cloud", "personal-email-domain", "external-cloud-storage"],
        weights=[0.55, 0.3, 0.08, 0.07],
    )[0]
    if anomaly in ("large_data_transfer", "combo_high_risk"):
        dest = random.choice(["personal-email-domain", "external-cloud-storage"])
    hour_base = user.typical_login_hour if anomaly not in ("off_hours_access", "combo_high_risk") else 23.0
    ts = day_date + timedelta(hours=random.gauss(hour_base + 3, 1.5))
    events.append({
        "event_type": "data_transfer", "user_id": user.user_id, "timestamp": ts.isoformat(),
        "destination": dest, "bytes_mb": round(mb, 1),
    })
    return events


def generate_all():
    profiles = build_user_profiles()
    injections = pick_anomaly_calendar(profiles)
    inject_map = {}
    for uid, offset, scenario in injections:
        inject_map.setdefault(uid, {})[offset] = scenario

    all_events = []
    ground_truth = []
    for user in profiles:
        for d in range(NUM_DAYS):
            day_date = START_DATE + timedelta(days=d)
            anomaly = inject_map.get(user.user_id, {}).get(d)
            all_events += gen_login_events(user, day_date, anomaly)
            all_events += gen_file_events(user, day_date, anomaly)
            all_events += gen_usb_events(user, day_date, anomaly)
            all_events += gen_transfer_events(user, day_date, anomaly)
            if anomaly:
                ground_truth.append({
                    "user_id": user.user_id, "date": day_date.date().isoformat(), "scenario": anomaly,
                })

    all_events.sort(key=lambda e: e["timestamp"])

    profile_out = [
        {
            "user_id": p.user_id, "department": p.department,
            "known_usb_devices": p.known_usb_devices,
            "sensitive_access_normal": p.sensitive_access_normal,
        }
        for p in profiles
    ]
    return all_events, ground_truth, profile_out


def main():
    out_dir = Path(__file__).parent / "data"
    out_dir.mkdir(exist_ok=True)
    events, ground_truth, profiles = generate_all()

    with open(out_dir / "events.json", "w") as f:
        json.dump(events, f, indent=2)
    with open(out_dir / "ground_truth.json", "w") as f:
        json.dump(ground_truth, f, indent=2)
    with open(out_dir / "user_profiles.json", "w") as f:
        json.dump(profiles, f, indent=2)

    print(f"Generated {len(events)} events across {NUM_USERS} users / {NUM_DAYS} days")
    print(f"Injected {len(ground_truth)} anomalous user-days (hidden from the detector)")


if __name__ == "__main__":
    main()

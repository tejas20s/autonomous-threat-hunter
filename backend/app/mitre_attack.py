"""
MITRE ATT&CK mapping module.

Maps detection features and alert patterns to MITRE ATT&CK techniques
relevant to insider threats, primarily from the Initial Access,
Credential Access, Collection, Exfiltration, and Impact tactics.
"""

from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import MITREMapping
from database import async_session_factory

# Hardcoded mapping for insider threat relevant techniques
# Based on MITRE ATT&CK v14
DEFAULT_MAPPINGS = [
    # ── Initial Access ──────────────────────────────────────────────
    {"technique_id": "T1078", "technique_name": "Valid Accounts", "tactic": "Initial Access",
     "detection_feature": "login_count", "description": "Use of valid credentials to log in", "severity_boost": 0},
    {"technique_id": "T1078.003", "technique_name": "Local Accounts", "tactic": "Initial Access",
     "detection_feature": "distinct_ips", "description": "Login from unexpected local account", "severity_boost": 0},

    # ── Credential Access ───────────────────────────────────────────
    {"technique_id": "T1110", "technique_name": "Brute Force", "tactic": "Credential Access",
     "detection_feature": "failed_logins", "description": "Multiple failed login attempts suggesting password guessing", "severity_boost": 5},

    # ── Collection ──────────────────────────────────────────────────
    {"technique_id": "T1005", "technique_name": "Data from Local System", "tactic": "Collection",
     "detection_feature": "files_accessed", "description": "Accessing files from local system", "severity_boost": 0},
    {"technique_id": "T1039", "technique_name": "Data from Network Shared Drive", "tactic": "Collection",
     "detection_feature": "files_accessed", "description": "Accessing files from network shares", "severity_boost": 0},
    {"technique_id": "T1213", "technique_name": "Data from Information Repositories", "tactic": "Collection",
     "detection_feature": "sensitive_files_accessed", "description": "Accessing sensitive data repositories", "severity_boost": 10},

    # ── Exfiltration ────────────────────────────────────────────────
    {"technique_id": "T1020", "technique_name": "Automated Exfiltration", "tactic": "Exfiltration",
     "detection_feature": "external_transfer_mb", "description": "Automated transfer of data to external destination", "severity_boost": 15},
    {"technique_id": "T1048", "technique_name": "Exfiltration Over Alternative Protocol", "tactic": "Exfiltration",
     "detection_feature": "transfer_mb", "description": "Data exfiltration over non-standard protocols", "severity_boost": 10},
    {"technique_id": "T1052", "technique_name": "Exfiltration Over Physical Medium", "tactic": "Exfiltration",
     "detection_feature": "usb_data_mb", "description": "Data exfiltration via USB or other physical media", "severity_boost": 20},
    {"technique_id": "T1567", "technique_name": "Exfiltration Over Web Service", "tactic": "Exfiltration",
     "detection_feature": "external_transfer_mb", "description": "Exfiltration using web services (email, cloud storage)", "severity_boost": 12},

    # ── Persistence ─────────────────────────────────────────────────
    {"technique_id": "T1098", "technique_name": "Account Manipulation", "tactic": "Persistence",
     "detection_feature": "after_hours_login", "description": "Suspicious account activity outside normal hours", "severity_boost": 8},

    # ── Impact ──────────────────────────────────────────────────────
    {"technique_id": "T1485", "technique_name": "Data Destruction", "tactic": "Impact",
     "detection_feature": "files_downloaded", "description": "Mass file access potentially leading to data destruction", "severity_boost": 10},
]


async def init_mitre_mappings():
    """Initialize default MITRE ATT&CK mappings in the database."""
    async with async_session_factory() as session:
        result = await session.execute(select(MITREMapping).limit(1))
        if result.scalar_one_or_none() is None:
            for m in DEFAULT_MAPPINGS:
                session.add(MITREMapping(**m))
            await session.commit()


FEATURE_TO_TECHNIQUE = {
    "after_hours_login": ("T1098", "Account Manipulation", "Persistence"),
    "failed_logins": ("T1110", "Brute Force", "Credential Access"),
    "distinct_ips": ("T1078.003", "Local Accounts", "Initial Access"),
    "files_accessed": ("T1005", "Data from Local System", "Collection"),
    "sensitive_files_accessed": ("T1213", "Data from Information Repositories", "Collection"),
    "files_downloaded": ("T1485", "Data Destruction", "Impact"),
    "usb_first_time": ("T1052", "Exfiltration Over Physical Medium", "Exfiltration"),
    "usb_data_mb": ("T1052", "Exfiltration Over Physical Medium", "Exfiltration"),
    "transfer_mb": ("T1048", "Exfiltration Over Alternative Protocol", "Exfiltration"),
    "external_transfer_mb": ("T1567", "Exfiltration Over Web Service", "Exfiltration"),
}


def get_mitre_technique(feature: str) -> Optional[dict]:
    """Get MITRE ATT&CK technique for a detection feature."""
    if feature in FEATURE_TO_TECHNIQUE:
        tid, name, tactic = FEATURE_TO_TECHNIQUE[feature]
        return {
            "technique_id": tid,
            "technique_name": name,
            "tactic": tactic,
        }
    return None


def get_primary_technique(reasons: list) -> Optional[dict]:
    """Get the primary MITRE technique from alert reasons."""
    if not reasons:
        return None
    # Use the highest-contribution reason to determine technique
    top_reason = max(reasons, key=lambda r: r.get("contribution", 0))
    return get_mitre_technique(top_reason.get("feature", ""))

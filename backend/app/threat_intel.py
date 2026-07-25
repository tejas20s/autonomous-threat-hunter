"""
Threat Intelligence integration module.

Provides IP reputation checking (VirusTotal stub), GeoIP lookup,
and enrichment of events with threat intelligence data.

In production, this would use actual APIs. For the demo, it
provides simulated threat intelligence responses.
"""

import random
from typing import Optional

# Simulated threat intel database
_MOCK_THREAT_DB = {
    "10.0.0.1": {"malicious": False, "score": 0, "source": "internal"},
    "10.0.0.100": {"malicious": False, "score": 0, "source": "internal"},
    "185.220.101.0": {"malicious": True, "score": 85, "source": "abuseipdb", "tags": ["tor", "scanner"]},
    "45.33.32.156": {"malicious": True, "score": 65, "source": "virustotal", "tags": ["scanner"]},
    "91.121.87.34": {"malicious": True, "score": 72, "source": "abuseipdb", "tags": ["brute-force"]},
}

# Simulated GeoIP database
_MOCK_GEOIP = {
    "10.": {"country": "Internal Network", "city": "Corporate", "org": "Internal"},
    "185.": {"country": "Germany", "city": "Frankfurt", "org": "Hetzner"},
    "45.": {"country": "United States", "city": "San Francisco", "org": "DigitalOcean"},
    "91.": {"country": "France", "city": "Paris", "org": "OVH"},
}


async def check_ip_reputation(ip_address: str) -> dict:
    """
    Check IP reputation against threat intelligence sources.

    Returns threat score (0-100), source, and any tags.
    In production, this queries VirusTotal, AbuseIPDB, etc.
    """
    # Check mock database first
    if ip_address in _MOCK_THREAT_DB:
        return _MOCK_THREAT_DB[ip_address]

    # Simulate random low-level threats for external IPs
    if not ip_address.startswith("10.") and not ip_address.startswith("192.168."):
        score = random.randint(0, 30)
        return {
            "malicious": score > 20,
            "score": score,
            "source": "simulated",
            "tags": ["low-risk"] if score > 15 else [],
        }

    return {"malicious": False, "score": 0, "source": "internal", "tags": []}


async def geoip_lookup(ip_address: str) -> dict:
    """
    Look up geographic information for an IP address.

    Returns country, city, and organization.
    In production, this queries MaxMind GeoIP or similar.
    """
    for prefix, info in _MOCK_GEOIP.items():
        if ip_address.startswith(prefix):
            return info

    # Simulated external IP
    return {
        "country": "Unknown",
        "city": "Unknown",
        "org": "Unknown ISP",
    }


async def enrich_alert_ips(evidence: dict) -> dict:
    """Enrich alert evidence with threat intel for any IP addresses."""
    enriched = {}

    # Check for source IPs in the evidence
    for key, value in evidence.items():
        if isinstance(value, str) and value.startswith(("10.", "192.", "172.", "185.", "45.", "91.")):
            threat = await check_ip_reputation(value)
            geo = await geoip_lookup(value)
            enriched[key] = {
                "ip": value,
                "threat_score": threat["score"],
                "malicious": threat["malicious"],
                "country": geo["country"],
                "city": geo["city"],
                "org": geo["org"],
                "tags": threat.get("tags", []),
            }

    return enriched


def get_ioc_summary(threat_data: dict) -> Optional[str]:
    """Generate a human-readable IOC summary from threat data."""
    if not threat_data:
        return None

    malicious_ips = [k for k, v in threat_data.items() if v.get("malicious")]
    if malicious_ips:
        ips = ", ".join(malicious_ips)
        return f"Suspicious IPs detected: {ips}"
    return None

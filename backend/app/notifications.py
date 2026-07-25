"""
Notification module for sending alerts via Email, Slack, and Teams.

ALL connection settings come from environment variables (loaded via .env).
No secrets are hardcoded.
"""

import asyncio
import json
import os
import logging
import smtplib
from email.mime.text import MIMEText
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session_factory
from models import NotificationConfig, NotificationLog

logger = logging.getLogger(__name__)

# ── All SMTP settings from env ───────────────────────────────────────────
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "noreply@soc.local")

SEVERITY_ORDER = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}


async def send_otp_email(recipient: str, otp_code: str) -> bool:
    """Send an OTP verification email using configured SMTP."""
    subject = "ThreatWatch — Your OTP Verification Code"
    message = (
        f"Welcome to ThreatWatch SOC Platform!\n\n"
        f"Your one-time verification code is:\n\n"
        f"   {otp_code}\n\n"
        f"This code expires in 10 minutes.\n\n"
        f"If you didn't request this, please ignore this email.\n"
        f"— ThreatWatch Security Team"
    )
    return await send_email_notification(recipient, subject, message)


async def get_enabled_channels(min_severity: str = "High") -> list[dict]:
    """Get all enabled notification channels meeting severity threshold."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(NotificationConfig).where(NotificationConfig.enabled == True)
        )
        channels = result.scalars().all()
        sev_level = SEVERITY_ORDER.get(min_severity, 2)
        return [
            {
                "channel": c.channel,
                "config": c.config_json,
                "min_severity": c.min_severity,
            }
            for c in channels
            if SEVERITY_ORDER.get(c.min_severity, 2) <= sev_level
        ]


def _send_smtp_sync(recipient: str, subject: str, message: str) -> bool:
    """Synchronous SMTP send (called via run_in_executor)."""
    if not SMTP_HOST or not SMTP_USERNAME:
        logger.warning(f"SMTP not configured. Set SMTP_HOST/SMTP_USERNAME/SMTP_PASSWORD in .env "
                       f"to send real emails. Email to {recipient} was NOT sent.")
        return False
    try:
        msg = MIMEText(message, "plain")
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = recipient

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        logger.error(f"SMTP send failed to {recipient}: {e}")
        return False


async def send_email_notification(
    recipient: str,
    subject: str,
    message: str,
    alert_id: Optional[str] = None,
) -> bool:
    """Send an email notification via SMTP (configured via .env)."""
    logger.info(f"[EMAIL] To: {recipient}, Subject: {subject}")
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _send_smtp_sync, recipient, subject, message)


async def send_slack_notification(
    webhook_url: str,
    message: str,
    alert_id: Optional[str] = None,
) -> bool:
    """Send a Slack webhook notification (stub)."""
    logger.info(f"[SLACK] Webhook: {webhook_url[:30]}..., Message: {message[:100]}")
    # In production: use httpx to POST to webhook URL
    return True


async def send_teams_notification(
    webhook_url: str,
    message: str,
    alert_id: Optional[str] = None,
) -> bool:
    """Send a Teams webhook notification (stub)."""
    logger.info(f"[TEAMS] Webhook: {webhook_url[:30]}..., Message: {message[:100]}")
    return True


async def notify_alert(alert: dict):
    """Send alert to all enabled notification channels based on severity."""
    severity = alert.get("severity", "Low")
    sev_level = SEVERITY_ORDER.get(severity, 0)

    if sev_level < SEVERITY_ORDER.get("High", 2):
        return  # Only High and Critical get notifications by default

    channels = await get_enabled_channels(severity)

    subject = f"[{severity}] Insider Threat Alert - {alert.get('user_id', 'Unknown')}"
    message = (
        f"Alert: {alert.get('alert_id', 'N/A')}\n"
        f"User: {alert.get('user_id', 'Unknown')}\n"
        f"Department: {alert.get('department', 'Unknown')}\n"
        f"Severity: {severity}\n"
        f"Risk Score: {alert.get('risk_score', 0)}\n"
        f"Date: {alert.get('date', 'Unknown')}\n"
    )

    # Add top reason
    reasons = alert.get("reasons", [])
    if reasons:
        message += f"\nTrigger: {reasons[0].get('explanation', 'N/A')}\n"

    for ch in channels:
        try:
            if ch["channel"] == "Email":
                recipient = ch["config"].get("recipient", "analyst@soc.local")
                await send_email_notification(recipient, subject, message, alert.get("alert_id"))
            elif ch["channel"] == "Slack":
                webhook = ch["config"].get("webhook_url", "")
                await send_slack_notification(webhook, message, alert.get("alert_id"))
            elif ch["channel"] == "Teams":
                webhook = ch["config"].get("webhook_url", "")
                await send_teams_notification(webhook, message, alert.get("alert_id"))

            # Log notification
            async with async_session_factory() as session:
                log = NotificationLog(
                    channel=ch["channel"],
                    alert_id=alert.get("alert_id"),
                    recipient=ch["config"].get("recipient", "unknown"),
                    subject=subject,
                    message=message,
                    status="sent",
                )
                session.add(log)
                await session.commit()
        except Exception as e:
            logger.error(f"Failed to send {ch['channel']} notification: {e}")
            async with async_session_factory() as session:
                log = NotificationLog(
                    channel=ch["channel"],
                    alert_id=alert.get("alert_id"),
                    subject=subject,
                    message=message,
                    status="failed",
                    error_message=str(e),
                )
                session.add(log)
                await session.commit()

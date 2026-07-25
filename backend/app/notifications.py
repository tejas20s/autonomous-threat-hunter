"""
Notification module for sending alerts via Email, Slack, and Teams.

Supports configurable channels and minimum severity thresholds.
In production, this would integrate with actual SMTP/Slack API/Teams webhook.
For the demo, it logs notifications and provides the framework.
"""

import json
import os
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session_factory
from models import NotificationConfig, NotificationLog

logger = logging.getLogger(__name__)


SEVERITY_ORDER = {"Low": 0, "Medium": 1, "High": 2, "Critical": 3}


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


async def send_email_notification(
    recipient: str,
    subject: str,
    message: str,
    alert_id: Optional[str] = None,
) -> bool:
    """Send an email notification (stub — logs instead of sending)."""
    logger.info(f"[EMAIL] To: {recipient}, Subject: {subject}")
    # In production: use smtplib or SendGrid/Mailgun API
    # For demo, we just log the notification
    return True


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

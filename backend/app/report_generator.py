"""
Report generation module.

Generates CSV exports for alerts, cases, user activity, and analytics data.
In production, this would also support PDF generation via ReportLab/WeasyPrint.
"""

import csv
import io
import json
from datetime import datetime
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session_factory
from models import Alert, InvestigationCase, DailyTimeline, DailyFeature, AuditLog


async def export_alerts_csv(
    severity: Optional[str] = None,
    user_id: Optional[str] = None,
    department: Optional[str] = None,
) -> str:
    """Export alerts as CSV."""
    async with async_session_factory() as session:
        query = select(Alert).order_by(Alert.risk_score.desc())
        if severity:
            query = query.where(Alert.severity == severity)
        if user_id:
            query = query.where(Alert.user_id == user_id)
        if department:
            query = query.where(Alert.department == department)

        result = await session.execute(query)
        alerts = result.scalars().all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Alert ID", "User ID", "Department", "Date", "Risk Score",
            "Severity", "Status", "Assigned To", "MITRE Technique",
            "Top Reason", "Created At",
        ])

        for a in alerts:
            top_reason = (a.reasons or [{}])[0].get("explanation", "") if a.reasons else ""
            writer.writerow([
                a.alert_id, a.user_id, a.department, a.date,
                a.risk_score, a.severity, a.status, a.assigned_to or "",
                a.mitre_technique_name or "",
                top_reason,
                a.created_at.isoformat() if a.created_at else "",
            ])

        return output.getvalue()


async def export_cases_csv(status: Optional[str] = None) -> str:
    """Export investigation cases as CSV."""
    async with async_session_factory() as session:
        query = select(InvestigationCase).order_by(InvestigationCase.updated_at.desc())
        if status:
            query = query.where(InvestigationCase.status == status)

        result = await session.execute(query)
        cases = result.scalars().all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Case ID", "Title", "User ID", "Status", "Severity",
            "Assigned To", "Alert Count", "Created At",
        ])

        for c in cases:
            writer.writerow([
                c.case_id, c.title, c.user_id, c.status, c.severity,
                c.assigned_to or "", len(c.alert_ids or []),
                c.created_at.isoformat() if c.created_at else "",
            ])

        return output.getvalue()


async def export_user_timeline_csv(user_id: str) -> str:
    """Export a user's daily timeline as CSV."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(DailyTimeline)
            .where(DailyTimeline.user_id == user_id)
            .order_by(DailyTimeline.date)
        )
        days = result.scalars().all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Date", "Risk Score", "Severity", "Files Accessed",
            "Sensitive Files", "USB Events", "Transfer (MB)",
            "After Hours Login", "Failed Logins",
        ])

        for d in days:
            writer.writerow([
                d.date, d.risk_score, d.severity, d.files_accessed,
                d.sensitive_files_accessed, d.usb_events, d.transfer_mb,
                d.after_hours_login, d.failed_logins,
            ])

        return output.getvalue()


async def export_audit_log_csv(limit: int = 1000) -> str:
    """Export audit logs as CSV."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit)
        )
        logs = result.scalars().all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Timestamp", "Username", "Action", "Resource Type",
            "Resource ID", "IP Address", "Details",
        ])

        for log in logs:
            writer.writerow([
                log.timestamp.isoformat() if log.timestamp else "",
                log.username, log.action, log.resource_type or "",
                log.resource_id or "", log.ip_address or "",
                json.dumps(log.details or {}),
            ])

        return output.getvalue()

"""
Case management module for alert investigation workflows.

Provides functions to create investigation cases, assign alerts,
add evidence, track status, and manage the investigation lifecycle.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session_factory
from models import InvestigationCase, CaseEvidence, Alert, AlertStatus


async def create_case(
    title: str,
    user_id: str,
    alert_ids: list[str],
    description: Optional[str] = None,
    severity: str = "Medium",
    assigned_to: Optional[str] = None,
    created_by: str = "analyst",
) -> dict:
    """Create a new investigation case from one or more alerts."""
    async with async_session_factory() as session:
        # Generate case ID
        result = await session.execute(select(func.count(InvestigationCase.id)))
        count = result.scalar() or 0
        case_id = f"CASE-{count + 1:04d}"

        case = InvestigationCase(
            case_id=case_id,
            title=title,
            description=description or "",
            user_id=user_id,
            alert_ids=alert_ids,
            severity=severity,
            assigned_to=assigned_to,
            created_by=created_by,
        )
        session.add(case)

        # Update linked alerts to INVESTIGATING status
        for aid in alert_ids:
            result = await session.execute(select(Alert).where(Alert.alert_id == aid))
            alert = result.scalar_one_or_none()
            if alert:
                alert.status = AlertStatus.INVESTIGATING.value
                alert.assigned_to = assigned_to

        await session.commit()
        return {
            "case_id": case_id,
            "title": title,
            "user_id": user_id,
            "alert_ids": alert_ids,
            "severity": severity,
            "status": "Open",
            "assigned_to": assigned_to,
            "created_by": created_by,
        }


async def get_case(case_id: str) -> Optional[dict]:
    """Get a single investigation case with evidence."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(InvestigationCase).where(InvestigationCase.case_id == case_id)
        )
        case = result.scalar_one_or_none()
        if not case:
            return None
        return {
            "case_id": case.case_id,
            "title": case.title,
            "description": case.description,
            "user_id": case.user_id,
            "alert_ids": case.alert_ids,
            "status": case.status,
            "severity": case.severity,
            "assigned_to": case.assigned_to,
            "created_by": case.created_by,
            "created_at": case.created_at.isoformat() if case.created_at else None,
            "updated_at": case.updated_at.isoformat() if case.updated_at else None,
            "closed_at": case.closed_at.isoformat() if case.closed_at else None,
            "resolution": case.resolution,
            "evidence": [
                {
                    "id": e.id,
                    "title": e.title,
                    "description": e.description,
                    "evidence_type": e.evidence_type,
                    "content": e.content,
                    "added_by": e.added_by,
                    "created_at": e.created_at.isoformat() if e.created_at else None,
                }
                for e in (case.evidence or [])
            ],
        }


async def list_cases(
    status: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 50,
) -> list[dict]:
    """List investigation cases with optional filters."""
    async with async_session_factory() as session:
        query = select(InvestigationCase).order_by(InvestigationCase.updated_at.desc())
        if status:
            query = query.where(InvestigationCase.status == status)
        if user_id:
            query = query.where(InvestigationCase.user_id == user_id)
        query = query.limit(limit)

        result = await session.execute(query)
        cases = result.scalars().all()
        return [
            {
                "case_id": c.case_id,
                "title": c.title,
                "user_id": c.user_id,
                "status": c.status,
                "severity": c.severity,
                "assigned_to": c.assigned_to,
                "alert_count": len(c.alert_ids or []),
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            }
            for c in cases
        ]


async def update_case_status(
    case_id: str,
    status: str,
    resolution: Optional[str] = None,
    username: str = "analyst",
) -> Optional[dict]:
    """Update the status of an investigation case."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(InvestigationCase).where(InvestigationCase.case_id == case_id)
        )
        case = result.scalar_one_or_none()
        if not case:
            return None

        case.status = status
        if status in ("Resolved", "False Positive"):
            case.closed_at = datetime.utcnow()
            if resolution:
                case.resolution = resolution

            # Update linked alerts
            for aid in (case.alert_ids or []):
                alert_result = await session.execute(
                    select(Alert).where(Alert.alert_id == aid)
                )
                alert = alert_result.scalar_one_or_none()
                if alert:
                    alert.status = AlertStatus.RESOLVED.value if status == "Resolved" else AlertStatus.FALSE_POSITIVE.value
                    alert.resolved_at = datetime.utcnow()
                    alert.resolution_notes = resolution

        await session.commit()
        return {"case_id": case_id, "status": status, "updated_by": username}


async def add_evidence(
    case_id: str,
    title: str,
    evidence_type: str = "note",
    description: Optional[str] = None,
    content: Optional[dict] = None,
    added_by: str = "analyst",
) -> Optional[dict]:
    """Add evidence to a case."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(InvestigationCase).where(InvestigationCase.case_id == case_id)
        )
        case = result.scalar_one_or_none()
        if not case:
            return None

        evidence = CaseEvidence(
            case_id=case.id,
            title=title,
            description=description or "",
            evidence_type=evidence_type,
            content=content or {},
            added_by=added_by,
        )
        session.add(evidence)
        await session.commit()

        return {
            "id": evidence.id,
            "title": evidence.title,
            "evidence_type": evidence_type,
            "added_by": added_by,
            "created_at": evidence.created_at.isoformat() if evidence.created_at else None,
        }

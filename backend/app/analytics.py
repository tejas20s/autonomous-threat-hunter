"""
Advanced analytics module.

Provides data for:
- Login hour heatmaps
- Department risk comparison
- Risk trends over time
- Anomaly distribution analysis
- Top risky users and departments
"""

from typing import Optional
from sqlalchemy import select, func, case, cast, Integer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import async_session_factory
from models import DailyFeature, Alert, UserProfile, DailyTimeline, InvestigationCase, AuditLog, CaseEvidence


async def get_login_hour_heatmap(department: str = None, limit: int = 100) -> list:
    """Get login hour distribution for heatmap visualization."""
    async with async_session_factory() as session:
        query = select(
            DailyFeature.avg_login_hour,
            DailyFeature.date,
            DailyFeature.user_id,
        ).where(DailyFeature.avg_login_hour.isnot(None))

        if department:
            query = query.where(DailyFeature.department == department)

        result = await session.execute(query.limit(limit))
        rows = result.all()

        # Bucket into hourly slots
        heatmap = {}
        for row in rows:
            if row.avg_login_hour is None:
                continue
            hour = int(row.avg_login_hour)
            if hour not in heatmap:
                heatmap[hour] = 0
            heatmap[hour] += 1

        return [
            {"hour": h, "count": c}
            for h, c in sorted(heatmap.items())
        ]


async def get_department_risk_comparison(user_id: str = None) -> list:
    """Compare risk scores across departments."""
    async with async_session_factory() as session:
        query = select(
            DailyFeature.department,
            func.avg(DailyFeature.risk_score).label("avg_risk"),
            func.max(DailyFeature.risk_score).label("max_risk"),
            func.count().label("total_days"),
            func.sum(case((DailyFeature.risk_score >= 40, 1), else_=0)).label("alert_days"),
        ).group_by(DailyFeature.department)

        if user_id:
            query = query.where(DailyFeature.user_id == user_id)

        result = await session.execute(query)
        rows = result.all()

        return [
            {
                "department": row.department,
                "avg_risk_score": round(float(row.avg_risk), 2),
                "max_risk_score": round(float(row.max_risk), 2),
                "total_days": int(row.total_days),
                "alert_days": int(row.alert_days),
                "alert_percentage": round(float(row.alert_days) / max(float(row.total_days), 1) * 100, 1),
            }
            for row in rows
        ]


async def get_risk_trend(days: int = 30) -> list:
    """Get daily risk score trend across all users."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(
                DailyTimeline.date,
                func.avg(DailyTimeline.risk_score).label("avg_score"),
                func.max(DailyTimeline.risk_score).label("max_score"),
                func.count().label("user_count"),
            )
            .group_by(DailyTimeline.date)
            .order_by(DailyTimeline.date.desc())
            .limit(days)
        )
        rows = result.all()

        return [
            {
                "date": row.date,
                "avg_risk_score": round(float(row.avg_score), 2),
                "max_risk_score": round(float(row.max_score), 2),
                "user_count": int(row.user_count),
            }
            for row in reversed(rows)
        ]


async def get_anomaly_distribution() -> dict:
    """Get distribution of anomaly types across all alerts."""
    async with async_session_factory() as session:
        result = await session.execute(select(Alert))
        alerts = result.scalars().all()

        distribution = {}
        for alert in alerts:
            for reason in (alert.reasons or []):
                feature = reason.get("feature", "unknown")
                if feature not in distribution:
                    distribution[feature] = {"count": 0, "total_contribution": 0.0}
                distribution[feature]["count"] += 1
                distribution[feature]["total_contribution"] += reason.get("contribution", 0)

        return {
            "anomalies": [
                {
                    "feature": k,
                    "count": v["count"],
                    "total_contribution": round(v["total_contribution"], 1),
                    "avg_contribution": round(v["total_contribution"] / max(v["count"], 1), 1),
                }
                for k, v in sorted(distribution.items(), key=lambda x: -x[1]["count"])
            ],
            "total_alert_count": len(alerts),
        }


async def get_top_risk_users(limit: int = 10) -> list:
    """Get users with highest average risk scores."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(
                DailyTimeline.user_id,
                func.avg(DailyTimeline.risk_score).label("avg_risk"),
                func.max(DailyTimeline.risk_score).label("max_risk"),
                func.count().label("active_days"),
                func.sum(case((DailyTimeline.risk_score >= 40, 1), else_=0)).label("alert_days"),
            )
            .group_by(DailyTimeline.user_id)
            .order_by(func.avg(DailyTimeline.risk_score).desc())
            .limit(limit)
        )
        rows = result.all()

        return [
            {
                "user_id": row.user_id,
                "avg_risk_score": round(float(row.avg_risk), 1),
                "max_risk_score": round(float(row.max_risk), 1),
                "active_days": int(row.active_days),
                "alert_days": int(row.alert_days),
            }
            for row in rows
        ]


async def get_weekly_trends(user_id: str = None) -> list:
    """Get weekly aggregation of risk scores."""
    async with async_session_factory() as session:
        from sqlalchemy import text

        if user_id:
            result = await session.execute(
                text("""
                    SELECT
                        strftime('%Y-W%W', date) as week,
                        AVG(risk_score) as avg_risk,
                        MAX(risk_score) as max_risk,
                        SUM(CASE WHEN risk_score >= 40 THEN 1 ELSE 0 END) as alerts
                    FROM daily_timelines
                    WHERE user_id = :uid
                    GROUP BY week
                    ORDER BY week
                """),
                {"uid": user_id}
            )
        else:
            result = await session.execute(
                text("""
                    SELECT
                        strftime('%Y-W%W', date) as week,
                        AVG(risk_score) as avg_risk,
                        MAX(risk_score) as max_risk,
                        SUM(CASE WHEN risk_score >= 40 THEN 1 ELSE 0 END) as alerts
                    FROM daily_timelines
                    GROUP BY week
                    ORDER BY week
                """)
            )

        rows = result.all()
        return [
            {
                "week": row.week,
                "avg_risk_score": round(float(row.avg_risk), 1),
                "max_risk_score": round(float(row.max_risk), 1),
                "alert_count": int(row.alerts),
            }
            for row in rows
        ]


async def get_detection_performance() -> dict:
    """
    Compute detection performance metrics using ground truth data.

    Calculates precision, recall, F1-score, false positive rate, and detection
    latency by comparing the model's High/Critical alerts against the known
    injected scenarios in ground_truth.json.
    """
    import json
    from pathlib import Path
    from datetime import datetime

    # Load ground truth
    gt_path = Path(__file__).parent / "data" / "ground_truth.json"
    if not gt_path.exists():
        return {
            "error": "Ground truth data not found",
            "total_injected_scenarios": 0,
            "precision": 0, "recall": 0, "f1_score": 0,
            "false_positive_rate": 0,
            "detection_latency_avg_hours": 0,
        }

    with open(gt_path) as f:
        ground_truth = json.load(f)

    total_injected = len(ground_truth)
    gt_lookup = {(g["user_id"], g["date"]): g["scenario"] for g in ground_truth}

    async with async_session_factory() as session:
        # Get all High/Critical alerts
        result = await session.execute(
            select(Alert).where(
                Alert.severity.in_(["High", "Critical"])
            )
        )
        high_crit_alerts = result.scalars().all()

        # Get all Low alerts (negatives)
        result = await session.execute(
            select(func.count(Alert.id)).where(Alert.severity == "Low")
        )
        total_low = result.scalar() or 0

    # True positives: High/Critical alerts that match a ground truth entry
    true_positives = 0
    detected_scenarios = set()
    false_positives = 0
    total_latency_hours = 0
    latency_count = 0

    for alert in high_crit_alerts:
        key = (alert.user_id, alert.date)
        if key in gt_lookup:
            true_positives += 1
            detected_scenarios.add(key)
            # Estimate detection latency: alerts are created on detection
            # For pipeline alerts, created_at - simulated event date
            if alert.created_at:
                try:
                    event_date = datetime.strptime(alert.date, "%Y-%m-%d")
                    created = alert.created_at.replace(tzinfo=None)
                    latency_h = (created - event_date).total_seconds() / 3600
                    total_latency_hours += max(0, latency_h)
                    latency_count += 1
                except Exception:
                    pass
        else:
            false_positives += 1

    false_negatives = total_injected - true_positives
    true_negatives = total_low  # Approximate: low severity = normal

    precision = true_positives / max(true_positives + false_positives, 1)
    recall = true_positives / max(total_injected, 1)
    f1 = 2 * precision * recall / max(precision + recall, 0.001)
    fpr = false_positives / max(false_positives + true_negatives, 1)
    avg_latency = total_latency_hours / max(latency_count, 1)

    # Confusion matrix
    return {
        "total_injected_scenarios": total_injected,
        "scenarios_caught_at_high_critical": true_positives,
        "scenarios_missed": false_negatives,
        "total_high_critical_alerts": len(high_crit_alerts),
        "false_positives": false_positives,
        "true_positives": true_positives,
        "false_negatives": false_negatives,
        "true_negatives_excluding_low": true_negatives,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1_score": round(f1, 4),
        "false_positive_rate": round(fpr, 4),
        "detection_latency_avg_hours": round(avg_latency, 1),
        "missed_scenarios": [
            {"user_id": g["user_id"], "date": g["date"], "scenario": g["scenario"]}
            for g in ground_truth
            if (g["user_id"], g["date"]) not in detected_scenarios
        ],
        "confusion_matrix": {
            "true_positives": true_positives,
            "false_positives": false_positives,
            "false_negatives": false_negatives,
            "true_negatives_approx": true_negatives,
        },
    }


async def get_executive_dashboard() -> dict:
    """
    Executive Dashboard summary: total employees, active alerts, organizational
    risk, department-wise risk, top risky employees, and threat trends.
    """
    async with async_session_factory() as session:
        # Total employees monitored
        result = await session.execute(select(func.count(UserProfile.user_id)))
        total_employees = result.scalar() or 0

        # Active (non-resolved, non-FP) alerts
        result = await session.execute(
            select(func.count(Alert.id)).where(
                Alert.status.notin_(["Resolved", "False Positive"])
            )
        )
        active_alerts = result.scalar() or 0

        # Overall average risk
        result = await session.execute(
            select(func.coalesce(func.avg(Alert.risk_score), 0))
        )
        avg_org_risk = round(float(result.scalar()), 1)

        # Department-wise risk
        result = await session.execute(
            select(
                DailyFeature.department,
                func.avg(DailyFeature.risk_score).label("avg_risk"),
                func.count(DailyFeature.id).label("total_days"),
                func.sum(func.cast(DailyFeature.risk_score >= 40, func.Integer)).label("alert_days"),
                func.max(DailyFeature.risk_score).label("max_risk"),
            )
            .group_by(DailyFeature.department)
        )
        departments = [
            {
                "department": row.department,
                "avg_risk_score": round(float(row.avg_risk), 1),
                "total_days": int(row.total_days),
                "alert_days": int(row.alert_days),
                "alert_rate": round(int(row.alert_days) / max(int(row.total_days), 1) * 100, 1),
                "max_risk_score": round(float(row.max_risk), 1),
            }
            for row in result.all()
        ]

        # Top risky employees (by avg risk score)
        result = await session.execute(
            select(
                DailyTimeline.user_id,
                func.avg(DailyTimeline.risk_score).label("avg_risk"),
                func.max(DailyTimeline.risk_score).label("max_risk"),
                func.count(DailyTimeline.id).label("active_days"),
                func.sum(func.cast(DailyTimeline.risk_score >= 40, func.Integer)).label("alert_days"),
            )
            .group_by(DailyTimeline.user_id)
            .order_by(func.avg(DailyTimeline.risk_score).desc())
            .limit(10)
        )
        top_employees = [
            {
                "user_id": row.user_id,
                "avg_risk_score": round(float(row.avg_risk), 1),
                "max_risk_score": round(float(row.max_risk), 1),
                "active_days": int(row.active_days),
                "alert_days": int(row.alert_days),
            }
            for row in result.all()
        ]

        # Severity distribution
        result = await session.execute(
            select(Alert.severity, func.count(Alert.id)).group_by(Alert.severity)
        )
        severity_counts = {"Low": 0, "Medium": 0, "High": 0, "Critical": 0}
        for sev, cnt in result.all():
            severity_counts[sev] = cnt

        # Open cases count
        result = await session.execute(
            select(func.count(InvestigationCase.id)).where(InvestigationCase.status == "Open")
        )
        open_cases = result.scalar() or 0

        return {
            "total_employees": total_employees,
            "active_alerts": active_alerts,
            "avg_organizational_risk": avg_org_risk,
            "open_investigations": open_cases,
            "total_alerts_all": sum(severity_counts.values()),
            "severity_counts": severity_counts,
            "departments": sorted(departments, key=lambda d: -d["avg_risk_score"]),
            "top_risky_employees": top_employees,
        }


async def get_investigation_summary(case_id: str) -> Optional[dict]:
    """
    Generate an investigation summary for a completed case.

    Includes employee info, detected attack type, evidence, risk scores,
    AI explanations, analyst actions, and final resolution.
    """
    async with async_session_factory() as session:
        result = await session.execute(
            select(InvestigationCase)
            .options(selectinload(InvestigationCase.evidence))
            .where(InvestigationCase.case_id == case_id)
        )
        case = result.scalar_one_or_none()
        if not case:
            return None

        # Get linked alerts
        linked_alerts = []
        for aid in (case.alert_ids or []):
            alert_result = await session.execute(
                select(Alert).where(Alert.alert_id == aid)
            )
            alert = alert_result.scalar_one_or_none()
            if alert:
                linked_alerts.append({
                    "alert_id": alert.alert_id,
                    "risk_score": alert.risk_score,
                    "severity": alert.severity,
                    "date": alert.date,
                    "mitre_technique_id": alert.mitre_technique_id,
                    "mitre_technique_name": alert.mitre_technique_name,
                    "isolation_forest_score": alert.isolation_forest_score,
                    "reasons": alert.reasons,
                    "status": alert.status,
                })

        # Get audit log entries for this case
        audit_result = await session.execute(
            select(AuditLog)
            .where(AuditLog.resource_type == "case", AuditLog.resource_id == case_id)
            .order_by(AuditLog.timestamp)
        )
        analyst_actions = [
            {
                "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                "username": log.username,
                "action": log.action,
                "details": log.details,
            }
            for log in audit_result.scalars().all()
        ]

        # Get evidence (eagerly loaded via selectinload)
        evidence_list = []
        if case.evidence:
            for e in case.evidence:
                evidence_list.append({
                    "id": e.id,
                    "title": e.title,
                    "description": e.description,
                    "evidence_type": e.evidence_type,
                    "added_by": e.added_by,
                    "created_at": e.created_at.isoformat() if e.created_at else None,
                })

        return {
            "case_id": case.case_id,
            "title": case.title,
            "employee_id": case.user_id,
            "detected_attack_type": max(
                [a.get("mitre_technique_name", "Unknown") for a in linked_alerts],
                default="Unknown"
            ),
            "evidence": evidence_list,
            "linked_alerts": linked_alerts,
            "aggregate_risk_score": max([a["risk_score"] for a in linked_alerts], default=0),
            "max_severity": max([a["severity"] for a in linked_alerts], default="Low")
                if linked_alerts else "Low",
            "ai_explanation_summary": [
                reason
                for alert in linked_alerts
                for reason in (alert.get("reasons") or [])
            ][:10],  # Top 10 across all linked alerts
            "analyst_actions": analyst_actions,
            "resolution": case.resolution,
            "case_status": case.status,
            "created_by": case.created_by,
            "assigned_to": case.assigned_to,
            "opened_at": case.created_at.isoformat() if case.created_at else None,
            "closed_at": case.closed_at.isoformat() if case.closed_at else None,
        }

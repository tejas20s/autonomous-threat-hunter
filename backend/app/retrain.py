"""
Model retraining module.

Provides scheduled and on-demand retraining of:
1. Behavioral baselines (per-user mean/std)
2. Isolation Forest model

This allows the system to adapt as user behavior legitimately
changes over time (role changes, reorgs, new workflows).
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session_factory
from models import (
    BehavioralBaseline, ModelTrainingLog, DailyFeature,
    UserProfile, Alert,
)
from baseline import build_user_baselines, NUMERIC_FEATURES
from model import run_detection, train_isolation_forest

logger = logging.getLogger(__name__)


async def retrain_baselines() -> dict:
    """Retrain behavioral baselines for all users."""
    async with async_session_factory() as session:
        # Get all features
        result = await session.execute(
            select(DailyFeature).order_by(DailyFeature.user_id, DailyFeature.date)
        )
        rows = result.scalars().all()

        if not rows:
            return {"status": "skipped", "reason": "No feature data available"}

        # Convert to pandas DataFrame for processing by baseline module
        import pandas as pd
        data = [
            {
                "user_id": r.user_id,
                "date": r.date,
                **{f: getattr(r, f, 0) for f in NUMERIC_FEATURES},
            }
            for r in rows
        ]
        df = pd.DataFrame(data)

        # Build baselines
        baselines_dict = build_user_baselines(df)

        # Store updated baselines
        for uid, bl in baselines_dict.items():
            result = await session.execute(
                select(BehavioralBaseline).where(BehavioralBaseline.user_id == uid)
            )
            existing = result.scalar_one_or_none()
            if existing:
                existing.features_json = bl["features"]
                existing.baseline_ready = bl["baseline_ready"]
                existing.days_seen = bl["days_seen"]
                existing.last_trained = datetime.utcnow()
                existing.version += 1
            else:
                session.add(BehavioralBaseline(
                    user_id=uid,
                    features_json=bl["features"],
                    baseline_ready=bl["baseline_ready"],
                    days_seen=bl["days_seen"],
                    last_trained=datetime.utcnow(),
                ))

        await session.commit()

        # Log training
        log = ModelTrainingLog(
            version=(await _get_latest_version()) + 1,
            training_days=df["date"].nunique(),
            users_trained=df["user_id"].nunique(),
            total_samples=len(df),
            model_params={"type": "baseline", "features": NUMERIC_FEATURES},
            triggered_by="manual",
            status="completed",
        )
        session.add(log)
        await session.commit()

        return {
            "status": "completed",
            "users_trained": int(df["user_id"].nunique()),
            "days_covered": int(df["date"].nunique()),
            "total_samples": int(len(df)),
        }


async def retrain_isolation_forest() -> dict:
    """Retrain the Isolation Forest model with latest data."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(DailyFeature).order_by(DailyFeature.user_id, DailyFeature.date)
        )
        rows = result.scalars().all()

        if not rows:
            return {"status": "skipped", "reason": "No feature data"}

        import pandas as pd
        import numpy as np

        data = [{f: getattr(r, f, 0) for f in NUMERIC_FEATURES} for r in rows]
        df = pd.DataFrame(data)

        model, anomaly_pct = train_isolation_forest(df)

        from sklearn.ensemble import IsolationForest
        contamination = max(0.01, model.contamination)

        # Update all feature rows with new IF scores
        for i, r in enumerate(rows):
            r.isolation_forest_score = round(float(anomaly_pct[i]), 1)

        await session.commit()

        # Log training
        log = ModelTrainingLog(
            version=(await _get_latest_version()) + 1,
            total_samples=len(df),
            contamination=contamination,
            model_params={
                "type": "isolation_forest",
                "n_estimators": model.n_estimators,
                "contamination": contamination,
            },
            triggered_by="manual",
            status="completed",
        )
        session.add(log)
        await session.commit()

        return {"status": "completed", "type": "isolation_forest", "samples": len(df)}


async def retrain_all() -> dict:
    """Run full retraining: baselines + Isolation Forest + rescoring."""
    bl_result = await retrain_baselines()
    if_result = await retrain_isolation_forest()

    # Re-score all user-days with updated baselines and model
    async with async_session_factory() as session:
        result = await session.execute(
            select(DailyFeature).order_by(DailyFeature.user_id, DailyFeature.date)
        )
        rows = result.scalars().all()

        import pandas as pd
        data = [
            {
                "user_id": r.user_id,
                "date": r.date,
                "department": r.department,
                **{f: getattr(r, f, 0) for f in NUMERIC_FEATURES},
                "isolation_forest_score": r.isolation_forest_score,
            }
            for r in rows
        ]
        df = pd.DataFrame(data)

        # Re-run detection with updated baselines
        # (baselines were already updated in retrain_baselines)
        from model import rule_based_score_and_reasons, severity_from_score

        updated_baselines = {}
        result = await session.execute(select(BehavioralBaseline))
        for bl in result.scalars().all():
            updated_baselines[bl.user_id] = {
                "features": bl.features_json,
                "baseline_ready": bl.baseline_ready,
                "days_seen": bl.days_seen,
            }

        for r in rows:
            if r.user_id in updated_baselines:
                baseline = updated_baselines[r.user_id]
                rule_score, reasons = rule_based_score_and_reasons(
                    {f: getattr(r, f, 0) for f in NUMERIC_FEATURES},
                    baseline,
                )
                if_score = r.isolation_forest_score
                blended = 0.4 * if_score + 0.6 * rule_score

                if not baseline["baseline_ready"]:
                    blended = min(blended, 35)
                if not reasons:
                    blended = min(blended, 30)

                r.risk_score = round(float(blended), 1)
                r.severity = severity_from_score(blended, baseline["baseline_ready"])
                r.reasons_json = reasons

        await session.commit()

    return {
        "baselines": bl_result,
        "isolation_forest": if_result,
        "full_retrain": True,
    }


async def _get_latest_version() -> int:
    """Get the latest model version number."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(func.max(ModelTrainingLog.version))
        )
        return result.scalar() or 0


async def scheduled_retrain():
    """Background task for periodic retraining."""
    while True:
        try:
            logger.info("Running scheduled model retraining...")
            result = await retrain_all()
            logger.info(f"Scheduled retraining complete: {result}")
        except Exception as e:
            logger.error(f"Scheduled retraining failed: {e}")

        # Run every 24 hours
        await asyncio.sleep(86400)

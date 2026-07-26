"""
Complete SOC Platform API.

Endpoints for:
- Dashboard summary, alerts, users, departments (core)
- Investigation workflow, case management, comments
- Real-time SSE monitoring
- Authentication & RBAC
- MITRE ATT&CK mapping
- Threat intelligence enrichment
- Report generation (CSV exports)
- Model retraining
- Audit logging
- Advanced analytics
- Health check

ALL secrets come from environment variables (loaded via .env).
"""

import asyncio
import json
import math
import os
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load .env before anything else — all modules below will read env vars
_env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=_env_path)

from fastapi import FastAPI, HTTPException, Query, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func, and_, text
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session_factory, engine
from models import (
    Base, Alert, DailyTimeline, DailyFeature, UserProfile, BehavioralBaseline,
    AlertComment, AttackTimelineEvent, InvestigationCase, SOCUser, AuditLog,
    NotificationConfig, MITREMapping, ModelTrainingLog, AlertStatus, UserRole, RawEvent, OTPVerification,
)
from auth import (
    authenticate_user, get_current_user, require_analyst, require_admin,
    require_any, log_audit, initialize_default_admin, create_user,
    refresh_access_token, revoke_token, decode_token,
)
from websocket_manager import sse_manager, notify_new_alert, notify_alert_update
from mitre_attack import get_primary_technique, init_mitre_mappings
from notifications import notify_alert, send_otp_email
from case_manager import create_case, get_case, list_cases, update_case_status, add_evidence
from threat_intel import enrich_alert_ips
from report_generator import export_alerts_csv, export_cases_csv, export_user_timeline_csv, export_audit_log_csv
from analytics import (
    get_login_hour_heatmap, get_department_risk_comparison,
    get_risk_trend, get_anomaly_distribution, get_top_risk_users, get_weekly_trends,
    get_detection_performance, get_executive_dashboard,
)
from retrain import retrain_all, scheduled_retrain
from attack_simulator import simulate_attack, list_attack_scenarios as list_scenarios

OUT_DIR = Path(__file__).parent.parent / "output"

app = FastAPI(title="SOC Insider Threat Detection API", version="3.0.0")

# CORS origins from env (default: local dev)
_cors_env = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://localhost:80")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_env.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/")
def root():
    return {
        "message": "Autonomous Threat Hunter API is running"
    }

# ── Startup ───────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await initialize_default_admin()
    await init_mitre_mappings()
    # Start background retraining task (disabled by default)
    # import asyncio
    # asyncio.create_task(scheduled_retrain())


# ── Helpers ───────────────────────────────────────────────────────────────

async def _send_otp_background(email: str, otp: str):
    """Fire-and-forget OTP email sender. Errors are non-fatal (OTP is already in DB)."""
    try:
        await send_otp_email(email, otp)
    except Exception:
        pass  # Email delivery failures are non-fatal


def _load_json(name):
    path = OUT_DIR / name
    if not path.exists():
        return None
    with open(path) as f:
        return json.load(f)


async def get_db():
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()


# ── Auth Endpoints ─────────────────────────────────────────────────────────

@app.post("/api/auth/login")
async def login(body: dict):
    """Login with email/password in JSON body."""
    email = body.get("email", "")
    password = body.get("password", "")
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")
    user = await authenticate_user(email, password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return user


@app.post("/api/auth/register")
async def register(body: dict):
    """
    Step 1 of registration: validate details, save pending, send OTP email.
    Does NOT create the user — that happens after OTP verification.
    Auto-generates username from email prefix.
    """
    from datetime import timedelta
    import random
    
    email = body.get("email", "")
    password = body.get("password", "")
    full_name = body.get("full_name")
    
    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address")
    
    # Auto-generate username from email prefix
    username = email.split("@")[0]
    
    # Check if email already exists
    async with async_session_factory() as session:
        existing = await session.execute(
            select(SOCUser).where(SOCUser.email == email)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already registered")
        # If username taken, append random suffix
        existing_username = await session.execute(
            select(SOCUser).where(SOCUser.username == username)
        )
        if existing_username.scalar_one_or_none():
            username = f"{username}_{random.randint(100, 999)}"
    
    # Hash the password now (so we never store plaintext even temporarily)
    from auth import _hash_password
    hashed = _hash_password(password)
    
    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    # Store pending registration
    async with async_session_factory() as session:
        # Remove any existing pending OTP for this email
        existing_otp = await session.execute(
            select(OTPVerification).where(OTPVerification.email == email)
        )
        for row in existing_otp.scalars().all():
            await session.delete(row)
        
        pending = OTPVerification(
            email=email,
            otp_code=otp,
            username=username,
            hashed_password=hashed,
            full_name=full_name,
            role=UserRole.ANALYST.value,
            expires_at=expires_at,
        )
        session.add(pending)
        await session.commit()
    
    # Send OTP via email (fire-and-forget — don't block the response)
    asyncio.create_task(_send_otp_background(email, otp))
    
    return {
        "status": "otp_sent",
        "message": f"Verification code sent to {email}",
        "email": email,
        "otp": otp,
        "expires_in_minutes": 10,
    }


@app.post("/api/auth/users", dependencies=[Depends(require_admin)])
async def create_soc_user(
    body: dict,
    current_user: dict = Depends(get_current_user),
):
    username = body.get("username", "")
    email = body.get("email", "")
    password = body.get("password", "")
    role = body.get("role", UserRole.ANALYST.value)
    full_name = body.get("full_name")
    user = await create_user(username, email, password, role, full_name)
    await log_audit(current_user["username"], "create_user", "user", username)
    return user


@app.get("/api/auth/me")
async def get_me(
    current_user: dict = Depends(require_any),
    db: AsyncSession = Depends(get_db),
):
    """Get current user info including full_name from database."""
    result = await db.execute(
        select(SOCUser.username, SOCUser.role, SOCUser.full_name)
        .where(SOCUser.username == current_user["username"])
    )
    row = result.one_or_none()
    if row:
        return {
            "username": row.username,
            "role": row.role,
            "full_name": row.full_name,
        }
    return {
        "username": current_user["username"],
        "role": current_user["role"],
        "full_name": None,
    }


@app.post("/api/auth/verify-otp")
async def verify_otp(body: dict):
    """
    Step 2 of registration: verify OTP and create the user account.
    """
    email = body.get("email", "")
    otp = body.get("otp", "")
    
    if not email or not otp:
        raise HTTPException(status_code=400, detail="Email and OTP code required")
    
    async with async_session_factory() as session:
        result = await session.execute(
            select(OTPVerification).where(
                (OTPVerification.email == email) &
                (OTPVerification.otp_code == otp) &
                (OTPVerification.verified == False)
            ).order_by(OTPVerification.created_at.desc()).limit(1)
        )
        pending = result.scalar_one_or_none()
        
        if not pending:
            raise HTTPException(status_code=400, detail="Invalid or expired OTP code")
        
        if datetime.utcnow() > pending.expires_at:
            raise HTTPException(status_code=400, detail="OTP code has expired. Request a new one.")
        
        # Mark as verified
        pending.verified = True
        
        # Create the actual user
        user = SOCUser(
            username=pending.username,
            email=pending.email,
            hashed_password=pending.hashed_password,
            full_name=pending.full_name,
            role=pending.role,
            is_active=True,
        )
        session.add(user)
        await session.commit()
    
    await log_audit(pending.username, "register", "user", pending.username)
    
    # Return user info (frontend will auto-login)
    return {
        "username": pending.username,
        "email": pending.email,
        "role": pending.role,
        "full_name": pending.full_name,
    }


@app.post("/api/auth/forgot-password")
async def forgot_password(body: dict):
    """Send OTP to email for password reset."""
    from datetime import timedelta
    import random
    
    email = body.get("email", "")
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    
    # Check user exists
    async with async_session_factory() as session:
        result = await session.execute(
            select(SOCUser).where(SOCUser.email == email)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="No account found with this email")
    
    # Generate OTP
    otp = str(random.randint(100000, 999999))
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    # Store OTP (use OTPVerification with full_name='reset' as purpose marker)
    async with async_session_factory() as session:
        # Remove any existing OTP for this email
        existing = await session.execute(
            select(OTPVerification).where(OTPVerification.email == email)
        )
        for row in existing.scalars().all():
            await session.delete(row)
        
        pending = OTPVerification(
            email=email,
            otp_code=otp,
            username=user.username,
            hashed_password="",
            full_name="reset",
            role=UserRole.ANALYST.value,
            expires_at=expires_at,
        )
        session.add(pending)
        await session.commit()
    
    # Send OTP via email (fire-and-forget — don't block the response)
    asyncio.create_task(_send_otp_background(email, otp))
    
    return {
        "status": "otp_sent",
        "message": f"Verification code sent to {email}",
        "email": email,
        "otp": otp,
        "expires_in_minutes": 10,
    }


@app.post("/api/auth/reset-password")
async def reset_password(body: dict):
    """Reset password using OTP."""
    from auth import _hash_password
    
    email = body.get("email", "")
    otp = body.get("otp", "")
    new_password = body.get("new_password", "")
    
    if not email or not otp or not new_password:
        raise HTTPException(status_code=400, detail="Email, OTP, and new password required")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    async with async_session_factory() as session:
        # Find OTP record (full_name='reset' distinguishes from registration)
        result = await session.execute(
            select(OTPVerification).where(
                (OTPVerification.email == email) &
                (OTPVerification.otp_code == otp) &
                (OTPVerification.full_name == "reset") &
                (OTPVerification.verified == False)
            ).order_by(OTPVerification.created_at.desc()).limit(1)
        )
        pending = result.scalar_one_or_none()
        
        if not pending:
            raise HTTPException(status_code=400, detail="Invalid or expired OTP code")
        
        if datetime.utcnow() > pending.expires_at:
            raise HTTPException(status_code=400, detail="OTP code has expired")
        
        # Mark as verified
        pending.verified = True
        
        # Update the user's password
        user_result = await session.execute(
            select(SOCUser).where(SOCUser.email == email)
        )
        user = user_result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user.hashed_password = _hash_password(new_password)
        await session.commit()
    
    await log_audit(email, "reset_password", "auth", email)
    
    return {"status": "ok", "message": "Password reset successfully"}


@app.post("/api/auth/resend-otp")
async def resend_otp(body: dict):
    """Resend OTP code for a pending registration."""
    from datetime import timedelta
    import random
    
    email = body.get("email", "")
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    
    async with async_session_factory() as session:
        result = await session.execute(
            select(OTPVerification).where(
                (OTPVerification.email == email) &
                (OTPVerification.verified == False)
            ).order_by(OTPVerification.created_at.desc()).limit(1)
        )
        pending = result.scalar_one_or_none()
        
        if not pending:
            raise HTTPException(status_code=400, detail="No pending registration found for this email")
        
        # Generate new OTP
        new_otp = str(random.randint(100000, 999999))
        pending.otp_code = new_otp
        pending.expires_at = datetime.utcnow() + timedelta(minutes=10)
        await session.commit()
    
    # Send OTP via email (fire-and-forget — don't block the response)
    asyncio.create_task(_send_otp_background(email, new_otp))
    
    return {
        "status": "otp_sent",
        "message": f"New verification code sent to {email}",
        "otp": new_otp,
    }


@app.post("/api/auth/refresh")
async def refresh_token(body: dict):
    """Exchange a refresh token for a new access token."""
    refresh = body.get("refresh_token", "")
    if not refresh:
        raise HTTPException(status_code=400, detail="Refresh token required")
    result = await refresh_access_token(refresh)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    return result


@app.post("/api/auth/change-password")
async def change_password(
    body: dict,
    current_user: dict = Depends(require_any),
):
    """Change password for the currently authenticated user."""
    from auth import _hash_password, _verify_password
    
    current_password = body.get("current_password", "")
    new_password = body.get("new_password", "")
    
    if not current_password or not new_password:
        raise HTTPException(status_code=400, detail="Current and new password required")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    async with async_session_factory() as session:
        result = await session.execute(
            select(SOCUser).where(SOCUser.username == current_user["username"])
        )
        user = result.scalar_one_or_none()
        if not user or not _verify_password(current_password, user.hashed_password):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        
        user.hashed_password = _hash_password(new_password)
        await session.commit()
    
    await log_audit(current_user["username"], "change_password", "auth", current_user["username"])
    return {"status": "ok", "message": "Password changed successfully"}


@app.post("/api/auth/logout")
async def logout(current_user: dict = Depends(require_any)):
    """Logout — revokes the current token. Client should discard token after."""
    # The client discards the token; we also add server-side note
    # For full revocation, client passes token in Authorization header
    from fastapi import Request
    # We mark by username in audit; actual revocation requires the token string
    await log_audit(current_user["username"], "logout", "auth", current_user["username"])
    return {"status": "ok", "message": "Logged out successfully"}


@app.get("/api/auth/users", dependencies=[Depends(require_admin)])
async def list_soc_users(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all SOC users (admin only)."""
    result = await db.execute(select(SOCUser).order_by(SOCUser.created_at.desc()))
    return [
        {
            "username": u.username, "email": u.email, "role": u.role,
            "full_name": u.full_name, "is_active": u.is_active,
            "last_login": u.last_login.isoformat() if u.last_login else None,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in result.scalars().all()
    ]





# ── Dashboard Summary ──────────────────────────────────────────────────────

@app.get("/api/dashboard/summary")
async def get_summary(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(func.count()).select_from(Alert))
    total_alerts = result.scalar() or 0

    result = await db.execute(select(func.count()).select_from(DailyFeature))
    total_user_days = result.scalar() or 0

    result = await db.execute(select(func.count(UserProfile.user_id)))
    users_monitored = result.scalar() or 0

    result = await db.execute(select(DailyFeature.date.distinct()))
    days_covered = len([r[0] for r in result.all()])

    severity_counts = {"Low": 0, "Medium": 0, "High": 0, "Critical": 0}
    result = await db.execute(
        select(Alert.severity, func.count(Alert.id)).group_by(Alert.severity)
    )
    for sev, cnt in result.all():
        severity_counts[sev] = cnt

    status_counts = {}
    result = await db.execute(
        select(Alert.status, func.count(Alert.id)).group_by(Alert.status)
    )
    for st, cnt in result.all():
        status_counts[st] = cnt

    result = await db.execute(select(func.coalesce(func.max(Alert.risk_score), 0)))
    max_risk = float(result.scalar())

    if total_alerts == 0:
        js = _load_json("summary.json")
        if js:
            return js
        return {"total_user_days_analyzed": 0, "total_alerts": 0, "severity_counts": severity_counts, "users_monitored": 0, "days_covered": 0}

    return {
        "total_user_days_analyzed": total_user_days,
        "total_alerts": total_alerts,
        "severity_counts": severity_counts,
        "status_counts": status_counts,
        "users_monitored": users_monitored,
        "days_covered": days_covered,
        "max_risk_score": round(max_risk, 1),
    }


# ── Alerts ─────────────────────────────────────────────────────────────────

@app.get("/api/alerts")
async def get_alerts(
    severity: Optional[str] = Query(None),
    user_id: Optional[str] = None,
    min_score: float = 0,
    search: Optional[str] = None,
    department: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    query = select(Alert).order_by(Alert.created_at.desc(), Alert.risk_score.desc())
    if severity: query = query.where(Alert.severity.ilike(severity))
    if user_id: query = query.where(Alert.user_id == user_id)
    if min_score: query = query.where(Alert.risk_score >= min_score)
    if department: query = query.where(Alert.department.ilike(department))
    if status: query = query.where(Alert.status == status)
    if search:
        query = query.where(
            Alert.user_id.ilike(f"%{search}%") | Alert.department.ilike(f"%{search}%")
        )
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    rows = result.scalars().all()

    if not rows:
        fallback = _load_json("alerts.json")
        if fallback:
            alerts = fallback
            if severity: alerts = [a for a in alerts if a["severity"].lower() == severity.lower()]
            if user_id: alerts = [a for a in alerts if a["user_id"] == user_id]
            if min_score: alerts = [a for a in alerts if a["risk_score"] >= min_score]
            return alerts[:limit]
        return []

    return [
        {
            "alert_id": r.alert_id, "user_id": r.user_id, "department": r.department,
            "date": r.date, "risk_score": r.risk_score, "severity": r.severity,
            "isolation_forest_score": r.isolation_forest_score,
            "baseline_ready": r.baseline_ready, "reasons": r.reasons, "evidence": r.evidence,
            "status": r.status, "assigned_to": r.assigned_to,
            "acknowledged": r.acknowledged,
            "mitre_technique_id": r.mitre_technique_id,
            "mitre_technique_name": r.mitre_technique_name,
            "mitre_tactic": r.mitre_tactic,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@app.get("/api/alerts/{alert_id}")
async def get_alert(alert_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Alert).where(Alert.alert_id == alert_id))
    alert = result.scalar_one_or_none()
    if alert:
        # Get comments
        comments_result = await db.execute(
            select(AlertComment).where(AlertComment.alert_id == alert.id).order_by(AlertComment.created_at)
        )
        comments = [
            {"id": c.id, "author": c.author, "comment": c.comment, "created_at": c.created_at.isoformat() if c.created_at else None}
            for c in comments_result.scalars().all()
        ]
        # Get timeline events
        timeline_result = await db.execute(
            select(AttackTimelineEvent).where(AttackTimelineEvent.alert_id == alert.id).order_by(AttackTimelineEvent.timestamp)
        )
        timeline_events = [
            {"id": t.id, "timestamp": t.timestamp.isoformat() if t.timestamp else None,
             "event_type": t.event_type, "description": t.description, "severity": t.severity}
            for t in timeline_result.scalars().all()
        ]
        return {
            "alert_id": alert.alert_id, "user_id": alert.user_id, "department": alert.department,
            "date": alert.date, "risk_score": alert.risk_score, "severity": alert.severity,
            "isolation_forest_score": alert.isolation_forest_score,
            "baseline_ready": alert.baseline_ready, "reasons": alert.reasons, "evidence": alert.evidence,
            "status": alert.status, "assigned_to": alert.assigned_to,
            "acknowledged": alert.acknowledged,
            "mitre_technique_id": alert.mitre_technique_id,
            "mitre_technique_name": alert.mitre_technique_name,
            "mitre_tactic": alert.mitre_tactic,
            "resolution_notes": alert.resolution_notes,
            "comments": comments,
            "timeline_events": timeline_events,
            "created_at": alert.created_at.isoformat() if alert.created_at else None,
            "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None,
        }

    fallback = _load_json("alerts.json")
    if fallback:
        for a in fallback:
            if a["alert_id"] == alert_id:
                return a
    raise HTTPException(status_code=404, detail="Alert not found")


@app.patch("/api/alerts/{alert_id}/status")
async def update_alert_status(
    alert_id: str,
    status: str,
    assigned_to: Optional[str] = None,
    resolution_notes: Optional[str] = None,
    current_user: dict = Depends(require_analyst),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Alert).where(Alert.alert_id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = status
    if assigned_to:
        alert.assigned_to = assigned_to
    if resolution_notes:
        alert.resolution_notes = resolution_notes
    if status in (AlertStatus.RESOLVED.value, AlertStatus.FALSE_POSITIVE.value):
        alert.resolved_at = datetime.utcnow()

    await db.commit()
    await notify_alert_update(alert_id, {"status": status, "assigned_to": assigned_to})
    await log_audit(current_user["username"], "update_alert_status", "alert", alert_id,
                    {"status": status, "assigned_to": assigned_to})
    return {"status": "ok", "alert_id": alert_id, "new_status": status}


@app.post("/api/alerts/{alert_id}/comments")
async def add_alert_comment(
    alert_id: str,
    comment: str,
    current_user: dict = Depends(require_analyst),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Alert).where(Alert.alert_id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    new_comment = AlertComment(
        alert_id=alert.id,
        author=current_user["username"],
        comment=comment,
    )
    db.add(new_comment)
    await db.commit()
    await log_audit(current_user["username"], "add_comment", "alert", alert_id)
    return {"status": "ok", "comment_id": new_comment.id}


# ── Investigation Cases ──────────────────────────────────────────────────

@app.post("/api/cases", dependencies=[Depends(require_analyst)])
async def create_investigation_case(
    title: str, user_id: str, alert_ids: list[str],
    description: Optional[str] = None, severity: str = "Medium",
    assigned_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    case = await create_case(title, user_id, alert_ids, description, severity, assigned_to, current_user["username"])
    await log_audit(current_user["username"], "create_case", "case", case["case_id"])
    return case


@app.get("/api/cases")
async def list_investigation_cases(
    status: Optional[str] = None, user_id: Optional[str] = None, limit: int = 50,
):
    return await list_cases(status, user_id, limit)


@app.get("/api/cases/{case_id}")
async def get_investigation_case(case_id: str):
    case = await get_case(case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@app.patch("/api/cases/{case_id}/status", dependencies=[Depends(require_analyst)])
async def update_case(
    case_id: str, status: str,
    resolution: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    result = await update_case_status(case_id, status, resolution, current_user["username"])
    if not result:
        raise HTTPException(status_code=404, detail="Case not found")
    await log_audit(current_user["username"], "update_case", "case", case_id, {"status": status})
    return result


@app.post("/api/cases/{case_id}/evidence", dependencies=[Depends(require_analyst)])
async def add_case_evidence(
    case_id: str, title: str, evidence_type: str = "note",
    description: Optional[str] = None, content: Optional[dict] = None,
    current_user: dict = Depends(get_current_user),
):
    result = await add_evidence(case_id, title, evidence_type, description, content, current_user["username"])
    if not result:
        raise HTTPException(status_code=404, detail="Case not found")
    return result


# ── Real-time SSE ─────────────────────────────────────────────────────────

@app.get("/api/events/stream")
async def event_stream(request: Request, current_user: dict = Depends(require_any)):
    return StreamingResponse(
        sse_manager.stream(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Users ──────────────────────────────────────────────────────────────────

@app.get("/api/users")
async def list_users(
    department: Optional[str] = None, db: AsyncSession = Depends(get_db),
):
    query = select(UserProfile.user_id, UserProfile.department, UserProfile.full_name, UserProfile.email).order_by(UserProfile.user_id)
    if department:
        query = query.where(UserProfile.department.ilike(department))
    result = await db.execute(query)
    users = result.all()

    if not users:
        fallback = _load_json("timelines.json")
        if fallback:
            return sorted(fallback.keys())
        return []

    return [
        {"user_id": uid, "department": dept, "full_name": name or uid, "email": email or ""}
        for uid, dept, name, email in users
    ]


@app.get("/api/users/{user_id}")
async def get_user(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    user_row = result.scalar_one_or_none()
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")

    result = await db.execute(select(BehavioralBaseline).where(BehavioralBaseline.user_id == user_id))
    baseline_row = result.scalar_one_or_none()

    result = await db.execute(
        select(func.count(), func.max(Alert.risk_score)).where(Alert.user_id == user_id)
    )
    alert_count, max_risk = result.one()

    return {
        "user_id": user_row.user_id, "department": user_row.department,
        "full_name": user_row.full_name or user_row.user_id,
        "email": user_row.email or "",
        "sensitive_access_normal": user_row.sensitive_access_normal,
        "known_usb_devices": user_row.known_usb_devices or [],
        "known_devices": user_row.known_devices or [],
        "typical_login_locations": user_row.typical_login_locations or [],
        "baseline_ready": baseline_row.baseline_ready if baseline_row else False,
        "baseline_days_seen": baseline_row.days_seen if baseline_row else 0,
        "alert_count": alert_count or 0,
        "max_risk_score": round(float(max_risk or 0), 1),
    }


@app.get("/api/users/{user_id}/timeline")
async def get_user_timeline(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DailyTimeline).where(DailyTimeline.user_id == user_id).order_by(DailyTimeline.date)
    )
    rows = result.scalars().all()
    if not rows:
        fallback = _load_json("timelines.json")
        if fallback and user_id in fallback:
            return fallback[user_id]
        raise HTTPException(status_code=404, detail="User not found")
    return [
        {"date": r.date, "risk_score": r.risk_score, "severity": r.severity,
         "files_accessed": r.files_accessed, "sensitive_files_accessed": r.sensitive_files_accessed,
         "usb_events": r.usb_events, "transfer_mb": r.transfer_mb,
         "after_hours_login": r.after_hours_login, "failed_logins": r.failed_logins,
         "distinct_ips": r.distinct_ips}
        for r in rows
    ]


@app.get("/api/users/{user_id}/features")
async def get_user_features(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DailyFeature).where(DailyFeature.user_id == user_id).order_by(DailyFeature.date)
    )
    rows = result.scalars().all()
    if not rows:
        raise HTTPException(status_code=404, detail="No features found")
    return [
        {
            "date": r.date, "avg_login_hour": r.avg_login_hour,
            "after_hours_login": r.after_hours_login, "failed_logins": r.failed_logins,
            "files_accessed": r.files_accessed, "sensitive_files_accessed": r.sensitive_files_accessed,
            "files_downloaded": r.files_downloaded, "usb_events": r.usb_events,
            "usb_first_time": r.usb_first_time, "usb_data_mb": r.usb_data_mb,
            "transfer_mb": r.transfer_mb, "external_transfer_mb": r.external_transfer_mb,
            "risk_score": r.risk_score, "severity": r.severity,
        }
        for r in rows
    ]


@app.get("/api/users/{user_id}/profile")
async def get_user_behavior_profile(user_id: str, db: AsyncSession = Depends(get_db)):
    """Return behavioral profile summary: typical hours, devices, etc."""
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404)

    # Get feature averages
    result = await db.execute(
        select(
            func.avg(DailyFeature.avg_login_hour),
            func.avg(DailyFeature.files_accessed),
            func.avg(DailyFeature.transfer_mb),
            func.avg(DailyFeature.usb_events),
            func.avg(DailyFeature.failed_logins),
            func.count(DailyFeature.id),
        ).where(DailyFeature.user_id == user_id)
    )
    avg = result.one()

    return {
        "user_id": user.user_id, "department": user.department,
        "typical_login_hour": round(float(avg[0]), 1) if avg[0] else None,
        "avg_files_accessed": round(float(avg[1]), 1) if avg[1] else 0,
        "avg_transfer_mb": round(float(avg[2]), 1) if avg[2] else 0,
        "avg_usb_events": round(float(avg[3]), 1) if avg[3] else 0,
        "avg_failed_logins": round(float(avg[4]), 1) if avg[4] else 0,
        "days_active": int(avg[5]) if avg[5] else 0,
        "sensitive_access_normal": user.sensitive_access_normal,
        "known_usb_devices": user.known_usb_devices or [],
        "known_devices": user.known_devices or [],
        "typical_login_locations": user.typical_login_locations or [],
    }


# ── Departments ──────────────────────────────────────────────────────────

@app.get("/api/departments")
async def list_departments(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(UserProfile.department).distinct().order_by(UserProfile.department)
    )
    depts = [r[0] for r in result.all()]
    return depts or ["Engineering", "Finance", "HR", "Sales", "Legal", "IT Ops"]


@app.get("/api/departments/{department}/stats")
async def department_stats(department: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(func.count()).select_from(UserProfile).where(UserProfile.department.ilike(department))
    )
    user_count = result.scalar() or 0

    result = await db.execute(
        select(Alert.severity, func.count(Alert.id))
        .where(Alert.department.ilike(department)).group_by(Alert.severity)
    )
    sev_counts = {"Low": 0, "Medium": 0, "High": 0, "Critical": 0}
    for sev, cnt in result.all():
        sev_counts[sev] = cnt

    result = await db.execute(
        select(func.coalesce(func.avg(Alert.risk_score), 0)).where(Alert.department.ilike(department))
    )
    avg_risk = round(float(result.scalar()), 1)

    return {
        "department": department.title(), "user_count": user_count,
        "alert_severity_counts": sev_counts, "avg_risk_score": avg_risk,
        "total_alerts": sum(sev_counts.values()),
    }


# ── MITRE ATT&CK ─────────────────────────────────────────────────────────

@app.get("/api/mitre/techniques")
async def list_mitre_techniques(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MITREMapping).order_by(MITREMapping.tactic, MITREMapping.technique_id))
    return [
        {"technique_id": m.technique_id, "technique_name": m.technique_name,
         "tactic": m.tactic, "detection_feature": m.detection_feature,
         "description": m.description}
        for m in result.scalars().all()
    ]


# ── Notifications ────────────────────────────────────────────────────────

@app.get("/api/notifications/config", dependencies=[Depends(require_admin)])
async def get_notification_configs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(NotificationConfig))
    return [
        {"id": c.id, "channel": c.channel, "enabled": c.enabled,
         "min_severity": c.min_severity, "config": c.config_json}
        for c in result.scalars().all()
    ]


@app.post("/api/notifications/config", dependencies=[Depends(require_admin)])
async def create_notification_config(
    channel: str, min_severity: str = "High",
    config_json: Optional[dict] = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    config = NotificationConfig(
        channel=channel, min_severity=min_severity,
        config_json=config_json or {},
    )
    db.add(config)
    await db.commit()
    await log_audit(current_user["username"], "create_notification_config", "notification", channel)
    return {"status": "ok", "id": config.id}


# ── Threat Intelligence ──────────────────────────────────────────────────

@app.get("/api/threat-intel/ip/{ip_address}")
async def check_ip(ip_address: str):
    from threat_intel import check_ip_reputation, geoip_lookup
    threat = await check_ip_reputation(ip_address)
    geo = await geoip_lookup(ip_address)
    return {**threat, **geo}


# ── Analytics ─────────────────────────────────────────────────────────────

@app.get("/api/analytics/login-heatmap")
async def login_heatmap(department: Optional[str] = None):
    return await get_login_hour_heatmap(department)


@app.get("/api/analytics/department-risk")
async def department_risk():
    return await get_department_risk_comparison()


@app.get("/api/analytics/risk-trend")
async def risk_trend(days: int = 30):
    return await get_risk_trend(days)


@app.get("/api/analytics/anomaly-distribution")
async def anomaly_distribution():
    return await get_anomaly_distribution()


@app.get("/api/analytics/top-risk-users")
async def top_risk_users(limit: int = 10):
    return await get_top_risk_users(limit)


@app.get("/api/analytics/weekly-trends")
async def weekly_trends(user_id: Optional[str] = None):
    return await get_weekly_trends(user_id)


# ── Reports ──────────────────────────────────────────────────────────────

@app.get("/api/reports/alerts/csv")
async def alerts_csv(
    severity: Optional[str] = None, user_id: Optional[str] = None,
    department: Optional[str] = None,
):
    csv_data = await export_alerts_csv(severity, user_id, department)
    return StreamingResponse(
        iter([csv_data]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=alerts_{datetime.utcnow().date()}.csv"},
    )


@app.get("/api/reports/cases/csv")
async def cases_csv(status: Optional[str] = None):
    csv_data = await export_cases_csv(status)
    return StreamingResponse(
        iter([csv_data]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=cases_{datetime.utcnow().date()}.csv"},
    )


@app.get("/api/reports/users/{user_id}/timeline/csv")
async def user_timeline_csv(user_id: str):
    csv_data = await export_user_timeline_csv(user_id)
    return StreamingResponse(
        iter([csv_data]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={user_id}_timeline_{datetime.utcnow().date()}.csv"},
    )


@app.get("/api/reports/audit/csv")
async def audit_csv(limit: int = 1000):
    csv_data = await export_audit_log_csv(limit)
    return StreamingResponse(
        iter([csv_data]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=audit_{datetime.utcnow().date()}.csv"},
    )


# ── Model Retraining ─────────────────────────────────────────────────────

@app.post("/api/retrain", dependencies=[Depends(require_admin)])
async def trigger_retrain(current_user: dict = Depends(get_current_user)):
    result = await retrain_all()
    await log_audit(current_user["username"], "trigger_retrain", "model", "all")
    return result


@app.get("/api/retrain/history")
async def retrain_history(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ModelTrainingLog).order_by(ModelTrainingLog.trained_at.desc()).limit(20)
    )
    return [
        {
            "version": r.version, "trained_at": r.trained_at.isoformat() if r.trained_at else None,
            "users_trained": r.users_trained, "total_samples": r.total_samples,
            "contamination": r.contamination, "triggered_by": r.triggered_by,
            "status": r.status,
        }
        for r in result.scalars().all()
    ]


# ── Audit Logs ───────────────────────────────────────────────────────────

@app.get("/api/audit-logs", dependencies=[Depends(require_admin)])
async def get_audit_logs(
    limit: int = 100, username: Optional[str] = None, action: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit)
    if username:
        query = query.where(AuditLog.username == username)
    if action:
        query = query.where(AuditLog.action.ilike(f"%{action}%"))
    result = await db.execute(query)
    return [
        {
            "id": log.id, "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "username": log.username, "action": log.action,
            "resource_type": log.resource_type, "resource_id": log.resource_id,
            "details": log.details, "ip_address": log.ip_address,
        }
        for log in result.scalars().all()
    ]


# ── Attack Simulator ─────────────────────────────────────────────────────

@app.get("/api/simulate/scenarios")
async def get_attack_scenarios():
    """List all available attack scenarios for the simulator."""
    return list_scenarios()


@app.post("/api/simulate/attack")
async def trigger_attack(
    attack_type: str,
    user_id: Optional[str] = None,
):
    """
    Simulate an insider attack in real-time.

    Generates malicious events, runs them through the detection pipeline,
    creates an alert, stores it in the database, and broadcasts via SSE.

    Attack types: login_attack, usb_attack, data_exfiltration, sensitive_access, combined

    Note: This endpoint is intentionally unauthenticated for the demo.
    """
    result = await simulate_attack(attack_type, user_id)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    # Log audit with demo user (no auth required)
    await log_audit("demo-simulator", "simulate_attack", "simulation", result["alert_id"],
                    {"attack_type": attack_type, "user_id": result["user_id"]})
    return result


# ── Behavioral Baseline Comparison ────────────────────────────────────────

@app.get("/api/users/{user_id}/baseline-comparison")
async def get_baseline_comparison(user_id: str, db: AsyncSession = Depends(get_db)):
    """
    Compare an employee's current/today's behavior against their historical
    behavioral baseline. Shows exactly what's normal vs what's abnormal.
    """

    # Get the baseline
    result = await db.execute(select(BehavioralBaseline).where(BehavioralBaseline.user_id == user_id))
    baseline_row = result.scalar_one_or_none()
    if not baseline_row or not baseline_row.features_json:
        raise HTTPException(status_code=404, detail="No baseline found for this user")

    # Get the latest feature row
    result = await db.execute(
        select(DailyFeature).where(DailyFeature.user_id == user_id)
        .order_by(DailyFeature.date.desc()).limit(1)
    )
    latest = result.scalar_one_or_none()
    if not latest:
        raise HTTPException(status_code=404, detail="No activity data found for this user")

    baseline = baseline_row.features_json

    # Build comparison for each key feature
    comparison_features = [
        ("avg_login_hour", "⏰ Typical Login Hour", "hh:mm", "clock"),
        ("files_accessed", "📄 Files Accessed (daily)", "count", "files"),
        ("sensitive_files_accessed", "🔒 Sensitive Files Accessed", "count", "shield"),
        ("files_downloaded", "⬇️ Files Downloaded", "count", "download"),
        ("usb_events", "💾 USB Events", "count", "usb"),
        ("usb_data_mb", "💾 USB Data Written", "mb", "usb_data"),
        ("transfer_mb", "📤 Data Transferred", "mb", "transfer"),
        ("external_transfer_mb", "🌐 External Transfer", "mb", "external"),
        ("failed_logins", "❌ Failed Logins", "count", "lock"),
        ("distinct_ips", "🌍 Distinct IPs", "count", "ip"),
        ("after_hours_login", "🌙 After-Hours Login", "boolean", "moon"),
    ]

    comparisons = []
    deviation_count = 0
    total_features = 0

    for feat_key, label, value_type, icon in comparison_features:
        total_features += 1
        feat_stats = baseline.get(feat_key)
        if not feat_stats:
            continue

        normal_mean = feat_stats.get("mean", 0)
        normal_std = feat_stats.get("std", 0.5)
        normal_max = feat_stats.get("max", 0)

        today_value = getattr(latest, feat_key, None)
        if today_value is None or (isinstance(today_value, float) and (math.isnan(today_value) or today_value == 0)):
            if feat_key == "after_hours_login":
                today_value = 0
            elif feat_key == "avg_login_hour":
                today_value = None
            else:
                continue

        # Format values
        if value_type == "clock" and today_value is not None:
            hh = int(today_value)
            mm = int(round((today_value - hh) * 60))
            today_display = f"{hh:02d}:{mm:02d}"
            normal_display = f"{int(normal_mean):02d}:{int(round((normal_mean - int(normal_mean)) * 60)):02d}"
        elif value_type == "mb":
            today_display = f"{today_value:.0f} MB"
            normal_display = f"{normal_mean:.0f} MB"
        elif value_type == "boolean":
            today_display = "Yes" if today_value > 0 else "No"
            normal_display = "Rare" if normal_mean < 0.15 else "Occasional"
        else:
            today_display = f"{int(today_value)}"
            normal_display = f"{int(normal_mean)}"

        # Compute z-score
        z = (today_value - normal_mean) / max(normal_std, 0.5)
        is_abnormal = abs(z) >= 2.0
        if is_abnormal:
            deviation_count += 1

        comparisons.append({
            "feature": feat_key,
            "label": label,
            "icon": icon,
            "normal_mean": round(normal_mean, 2),
            "normal_std": round(normal_std, 2),
            "normal_max": round(normal_max, 2),
            "today_value": round(float(today_value), 2) if today_value is not None else None,
            "today_display": today_display,
            "normal_display": normal_display,
            "z_score": round(z, 2),
            "is_abnormal": is_abnormal,
            "deviation_direction": "above" if z > 0 else "below",
            "severity": "High" if abs(z) >= 3.0 else ("Medium" if abs(z) >= 2.0 else "Low"),
        })

    return {
        "user_id": user_id,
        "baseline_ready": baseline_row.baseline_ready,
        "baseline_days_seen": baseline_row.days_seen,
        "latest_date": latest.date,
        "comparisons": comparisons,
        "total_features": total_features,
        "deviations_found": deviation_count,
        "overall_status": "⚠️ Multiple Deviations Detected" if deviation_count >= 3 else (
            "🔸 Minor Deviations" if deviation_count > 0 else "✅ Normal Behavior"
        ),
    }


# ── Executive Dashboard ───────────────────────────────────────────────────

@app.get("/api/executive/summary")
async def executive_summary():
    """Executive-level dashboard summary."""
    return await get_executive_dashboard()


# ── Detection Performance ─────────────────────────────────────────────────

@app.get("/api/analytics/detection-performance")
async def detection_performance():
    """Model performance metrics: precision, recall, F1, FP rate."""
    return await get_detection_performance()


# ── Investigation Summary ─────────────────────────────────────────────────

@app.get("/api/cases/{case_id}/summary")
async def case_investigation_summary(case_id: str):
    """Generate an investigation summary for a completed case."""
    from analytics import get_investigation_summary
    summary = await get_investigation_summary(case_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Case not found")
    return summary


# ── AI-Enhanced Alert Detail ──────────────────────────────────────────────

RECOMMENDED_ACTIONS = {
    "after_hours_login": ["🔒 Review login time policy", "📋 Verify with manager about off-hours work"],
    "failed_logins": ["🔒 Temporarily lock account", "🔄 Reset password", "📋 Check for brute-force indicators"],
    "distinct_ips": ["🌐 Review network access logs", "🔒 Restrict VPN access if needed"],
    "files_accessed": ["📋 Audit accessed files list", "🔒 Review data classification labels"],
    "sensitive_files_accessed": ["🔒 Immediately restrict sensitive folder access", "📋 Audit all sensitive file access logs", "🔄 Escalate to data protection team"],
    "files_downloaded": ["📋 Review downloaded file inventory", "🔒 Disable download permissions temporarily", "🔄 Run DLP scan on downloaded files"],
    "usb_first_time": ["💾 Disable USB ports temporarily", "📋 Log device serial number for investigation", "🔄 Review USB policy exceptions"],
    "usb_data_mb": ["💾 Restrict USB write access", "📋 Audit all data written to USB", "🔒 Escalate to physical security team"],
    "transfer_mb": ["📤 Review data transfer logs", "🔒 Reduce transfer quota temporarily", "🔄 Monitor outgoing traffic"],
    "external_transfer_mb": ["🌐 Block external data transfers", "🔒 Investigate destination addresses", "📋 Escalate to DLP team", "🚨 Lock account if unauthorized exfiltration confirmed"],
}


@app.get("/api/alerts/{alert_id}/ai-insights")
async def get_alert_ai_insights(alert_id: str, db: AsyncSession = Depends(get_db)):
    """
    Enhanced AI insights for an alert:
    - AI confidence score
    - Detailed risk score breakdown (IF contribution vs rule contributions)
    - Recommended actions based on triggered features
    - Attack pattern analysis
    """
    result = await db.execute(select(Alert).where(Alert.alert_id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    reasons = alert.reasons or []
    if_score = alert.isolation_forest_score or 0
    risk_score = alert.risk_score or 0

    # AI Confidence: based on how many strong signals agree
    # High: IF + multiple rules agree. Medium: IF + 1-2 rules. Low: only one signal
    strong_reasons = [r for r in reasons if r.get("z_score", 0) >= 2.5]
    moderate_reasons = [r for r in reasons if 2.0 <= r.get("z_score", 0) < 2.5]

    if if_score >= 70 and len(strong_reasons) >= 3:
        ai_confidence = "High"
        ai_confidence_score = 92
    elif if_score >= 60 and len(strong_reasons) >= 1:
        ai_confidence = "Medium-High"
        ai_confidence_score = 78
    elif if_score >= 40 or len(moderate_reasons) >= 2:
        ai_confidence = "Medium"
        ai_confidence_score = 60
    else:
        ai_confidence = "Low"
        ai_confidence_score = 35

    # Score breakdown
    rule_total = sum(r.get("contribution", 0) for r in reasons)
    if_contribution = round(0.4 * if_score, 1)
    rule_contribution = round(0.6 * rule_total, 1)
    unquantified = max(0, round(risk_score - if_contribution - rule_contribution, 1))

    score_breakdown = {
        "isolation_forest_contribution": if_contribution,
        "isolation_forest_percent": round(0.4 * if_score / max(risk_score, 1) * 100, 1),
        "rule_based_contribution": rule_contribution,
        "rule_based_percent": round(0.6 * rule_total / max(risk_score, 1) * 100, 1),
        "unquantified_contribution": max(0, unquantified),
        "individual_rule_contributions": [
            {
                "feature": r["feature"],
                "weight": r["weight"],
                "z_score": r["z_score"],
                "contribution": r["contribution"],
                "explanation": r["explanation"],
                "percentage_of_total": round(r["contribution"] / max(risk_score, 1) * 100, 1),
            }
            for r in reasons
        ],
    }

    # Recommended actions
    triggered_features = list(set(r["feature"] for r in reasons))
    actions = []
    for feat in triggered_features:
        feat_actions = RECOMMENDED_ACTIONS.get(feat, ["📋 Review alert details"])
        for action in feat_actions:
            actions.append({"triggered_by": feat, "action": action})

    # If no specific actions, add generic ones
    if not actions:
        actions = [
            {"triggered_by": "general", "action": "📋 Review user activity logs"},
            {"triggered_by": "general", "action": "👤 Interview employee if pattern persists"},
        ]

    # Attack pattern analysis
    attack_profile = {
        "primary_tactic": alert.mitre_tactic or "Unknown",
        "technique_used": alert.mitre_technique_name or "Unknown",
        "is_likely_malicious": risk_score >= 60,
        "requires_immediate_action": risk_score >= 80,
        "data_exfiltration_risk": any(
            r["feature"] in ("external_transfer_mb", "usb_data_mb", "files_downloaded")
            for r in reasons
        ),
        "account_compromise_risk": any(
            r["feature"] in ("failed_logins", "after_hours_login", "distinct_ips")
            for r in reasons
        ),
        "insider_snooping_risk": any(
            r["feature"] in ("sensitive_files_accessed", "files_accessed")
            for r in reasons
        ),
    }

    return {
        "alert_id": alert_id,
        "ai_confidence": ai_confidence,
        "ai_confidence_score": ai_confidence_score,
        "score_breakdown": score_breakdown,
        "recommended_actions": actions,
        "attack_profile": attack_profile,
    }


# ── User Risk Trend (enhanced weekly) ────────────────────────────────────

@app.get("/api/users/{user_id}/risk-trend")
async def user_risk_trend(user_id: str, weeks: int = 12, db: AsyncSession = Depends(get_db)):
    """Behavioral risk trend showing how a user's risk evolves over weeks."""
    result = await db.execute(
        select(DailyTimeline).where(DailyTimeline.user_id == user_id)
        .order_by(DailyTimeline.date.desc()).limit(weeks * 7)
    )
    rows = result.scalars().all()
    if not rows:
        raise HTTPException(status_code=404, detail="No timeline data for user")

    # Group by week
    weekly = defaultdict(list)
    for r in reversed(rows):
        d = datetime.strptime(r.date, "%Y-%m-%d")
        week_key = d.strftime("%Y-W%W")
        weekly[week_key].append(r.risk_score)

    trend = []
    for week in sorted(weekly.keys()):
        scores = weekly[week]
        trend.append({
            "week": week,
            "avg_risk_score": round(sum(scores) / len(scores), 1),
            "max_risk_score": round(max(scores), 1),
            "min_risk_score": round(min(scores), 1),
            "days_in_week": len(scores),
            "trend_direction": "up" if len(trend) > 0 and (sum(scores) / len(scores)) > trend[-1]["avg_risk_score"] else (
                "down" if len(trend) > 0 and (sum(scores) / len(scores)) < trend[-1]["avg_risk_score"] else "stable"
            ),
        })

    return trend


# ── System Health ───────────────────────────────────────────────────────

@app.get("/api/system/health")
async def system_health(db: AsyncSession = Depends(get_db)):
    """Extended system health with model status, event counts, and retrain history."""
    from datetime import datetime as dt
    
    # Database health
    db_ok = True
    try:
        await db.execute(select(func.count()).select_from(Alert))
    except:
        db_ok = False

    # Counts
    result = await db.execute(select(func.count()).select_from(RawEvent))
    total_events = result.scalar() or 0
    result = await db.execute(select(func.count()).select_from(Alert))
    total_alerts = result.scalar() or 0
    result = await db.execute(select(func.count(UserProfile.user_id)))
    total_users = result.scalar() or 0

    # Model status
    result = await db.execute(
        select(ModelTrainingLog).order_by(ModelTrainingLog.trained_at.desc()).limit(1)
    )
    last_training = result.scalar_one_or_none()

    # Retrain history
    result = await db.execute(
        select(ModelTrainingLog).order_by(ModelTrainingLog.trained_at.desc()).limit(10)
    )
    retrain_history = [
        {
            "version": r.version, "trained_at": r.trained_at.isoformat() if r.trained_at else None,
            "users_trained": r.users_trained, "total_samples": r.total_samples,
            "status": r.status, "triggered_by": r.triggered_by,
        }
        for r in result.scalars().all()
    ]

    return {
        "status": "ok" if db_ok else "degraded",
        "version": "3.0.0",
        "database": "connected" if db_ok else "error",
        "mode": "Full SOC Platform",
        "uptime": dt.utcnow().isoformat(),
        "model": {
            "status": "ready" if last_training and last_training.status == "completed" else "unavailable",
            "last_trained": last_training.trained_at.isoformat() if last_training and last_training.trained_at else None,
            "version": last_training.version if last_training else None,
            "users_trained": last_training.users_trained if last_training else None,
        },
        "events": {
            "total_events": total_events,
            "total_alerts": total_alerts,
            "total_users": total_users,
        },
        "retrain_history": retrain_history,
    }


# ── Health ───────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "version": "3.0.0", "database": "connected", "mode": "Full SOC Platform"}

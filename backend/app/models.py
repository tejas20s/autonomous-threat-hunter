"""
SQLAlchemy ORM models for the SOC insider threat detection platform.

Includes tables for:
- User profiles & raw events (core detection)
- Behavioral baselines, features, alerts (detection pipeline)
- Alert investigation workflow, case management, comments
- RBAC roles, audit logs, notifications, MITRE ATT&CK mappings
- Model retraining metadata
"""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, Float, String, Boolean, DateTime, Text, JSON, ForeignKey,
    Index, UniqueConstraint, Enum as SAEnum,
)
from sqlalchemy.orm import DeclarativeBase, relationship
import enum


class Base(DeclarativeBase):
    pass


# ── Enums ──────────────────────────────────────────────────────────────────

class AlertStatus(str, enum.Enum):
    OPEN = "Open"
    INVESTIGATING = "Investigating"
    RESOLVED = "Resolved"
    FALSE_POSITIVE = "False Positive"

class UserRole(str, enum.Enum):
    ADMIN = "Admin"
    ANALYST = "Analyst"
    VIEWER = "Viewer"

class NotificationChannel(str, enum.Enum):
    EMAIL = "Email"
    SLACK = "Slack"
    TEAMS = "Teams"


# ── Core Detection Models ──────────────────────────────────────────────────

class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(20), unique=True, nullable=False, index=True)
    email = Column(String(100), nullable=True)
    full_name = Column(String(100), nullable=True)
    department = Column(String(50), nullable=False)
    role = Column(String(20), default="Employee")
    typical_login_hour = Column(Float, default=9.0)
    login_hour_std = Column(Float, default=0.5)
    typical_files_per_day = Column(Float, default=15.0)
    sensitive_access_normal = Column(Boolean, default=False)
    known_usb_devices = Column(JSON, default=list)
    typical_transfer_mb = Column(Float, default=40.0)
    typical_login_locations = Column(JSON, default=list)
    known_devices = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)


class RawEvent(Base):
    __tablename__ = "raw_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_type = Column(String(20), nullable=False, index=True)
    user_id = Column(String(20), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    metadata_json = Column(JSON, default=dict)
    source_ip = Column(String(45), nullable=True)
    geoip_country = Column(String(100), nullable=True)
    geoip_city = Column(String(100), nullable=True)
    threat_intel_score = Column(Float, nullable=True)

    __table_args__ = (
        Index("ix_events_user_ts", "user_id", "timestamp"),
        Index("ix_events_type_ts", "event_type", "timestamp"),
    )


class BehavioralBaseline(Base):
    __tablename__ = "behavioral_baselines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(20), unique=True, nullable=False, index=True)
    baseline_ready = Column(Boolean, default=False)
    days_seen = Column(Integer, default=0)
    features_json = Column(JSON, default=dict)
    last_trained = Column(DateTime, nullable=True)
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DailyFeature(Base):
    __tablename__ = "daily_features"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(20), nullable=False, index=True)
    date = Column(String(10), nullable=False)
    weekday = Column(Integer, default=0)
    is_weekend = Column(Integer, default=0)
    avg_login_hour = Column(Float, nullable=True)
    earliest_login_hour = Column(Float, nullable=True)
    after_hours_login = Column(Integer, default=0)
    failed_logins = Column(Integer, default=0)
    login_count = Column(Integer, default=0)
    distinct_ips = Column(Integer, default=0)
    files_accessed = Column(Integer, default=0)
    sensitive_files_accessed = Column(Integer, default=0)
    files_downloaded = Column(Integer, default=0)
    usb_events = Column(Integer, default=0)
    usb_first_time = Column(Integer, default=0)
    usb_data_mb = Column(Float, default=0.0)
    transfer_mb = Column(Float, default=0.0)
    external_transfer_mb = Column(Float, default=0.0)
    department = Column(String(50), default="Unknown")
    isolation_forest_score = Column(Float, default=0.0)
    risk_score = Column(Float, default=0.0)
    severity = Column(String(20), default="Low")
    baseline_ready = Column(Boolean, default=False)
    reasons_json = Column(JSON, default=list)

    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_user_date"),
        Index("ix_features_severity", "severity"),
    )


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    alert_id = Column(String(20), unique=True, nullable=False, index=True)
    user_id = Column(String(20), nullable=False, index=True)
    department = Column(String(50), nullable=False)
    date = Column(String(10), nullable=False, index=True)
    risk_score = Column(Float, nullable=False)
    severity = Column(String(20), nullable=False, index=True)
    isolation_forest_score = Column(Float, default=0.0)
    baseline_ready = Column(Boolean, default=False)
    reasons = Column(JSON, default=list)
    evidence = Column(JSON, default=dict)
    mitre_technique_id = Column(String(20), nullable=True)
    mitre_technique_name = Column(String(200), nullable=True)
    mitre_tactic = Column(String(100), nullable=True)
    status = Column(String(20), default=AlertStatus.OPEN.value)
    assigned_to = Column(String(50), nullable=True)
    acknowledged = Column(Boolean, default=False)
    acknowledged_by = Column(String(50), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_alerts_severity_score", "severity", "risk_score"),
        Index("ix_alerts_status", "status"),
    )

    # Relationships
    comments = relationship("AlertComment", back_populates="alert", cascade="all, delete-orphan")
    timeline_events = relationship("AttackTimelineEvent", back_populates="alert", cascade="all, delete-orphan")


class DailyTimeline(Base):
    __tablename__ = "daily_timelines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(20), nullable=False, index=True)
    date = Column(String(10), nullable=False)
    risk_score = Column(Float, default=0.0)
    severity = Column(String(20), default="Low")
    files_accessed = Column(Integer, default=0)
    sensitive_files_accessed = Column(Integer, default=0)
    usb_events = Column(Integer, default=0)
    transfer_mb = Column(Float, default=0.0)
    after_hours_login = Column(Integer, default=0)
    failed_logins = Column(Integer, default=0)
    distinct_ips = Column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_timeline_user_date"),
        Index("ix_timeline_user", "user_id"),
    )


# ── Alert Investigation & Case Management ──────────────────────────────────

class AlertComment(Base):
    __tablename__ = "alert_comments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    alert_id = Column(Integer, ForeignKey("alerts.id"), nullable=False)
    author = Column(String(50), nullable=False)
    comment = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    alert = relationship("Alert", back_populates="comments")


class AttackTimelineEvent(Base):
    __tablename__ = "attack_timeline_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    alert_id = Column(Integer, ForeignKey("alerts.id"), nullable=False)
    user_id = Column(String(20), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False)
    event_type = Column(String(50), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(String(20), default="info")
    metadata_json = Column(JSON, default=dict)

    alert = relationship("Alert", back_populates="timeline_events")

    __table_args__ = (
        Index("ix_timeline_alert_ts", "alert_id", "timestamp"),
    )


class InvestigationCase(Base):
    __tablename__ = "investigation_cases"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(String(20), unique=True, nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    user_id = Column(String(20), nullable=False, index=True)
    alert_ids = Column(JSON, default=list)
    status = Column(String(20), default="Open")
    severity = Column(String(20), default="Medium")
    assigned_to = Column(String(50), nullable=True)
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)
    resolution = Column(Text, nullable=True)

    # Relationships
    evidence = relationship("CaseEvidence", back_populates="case", cascade="all, delete-orphan")


class CaseEvidence(Base):
    __tablename__ = "case_evidence"

    id = Column(Integer, primary_key=True, autoincrement=True)
    case_id = Column(Integer, ForeignKey("investigation_cases.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    evidence_type = Column(String(50), default="note")
    content = Column(JSON, default=dict)
    added_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("InvestigationCase", back_populates="evidence")


# ── RBAC & Authentication ──────────────────────────────────────────────────

class SOCUser(Base):
    __tablename__ = "soc_users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=True)
    role = Column(String(20), default=UserRole.ANALYST.value)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)


# ── Audit Logging ──────────────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    username = Column(String(50), nullable=False)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(String(50), nullable=True)
    details = Column(JSON, default=dict)
    ip_address = Column(String(45), nullable=True)

    __table_args__ = (
        Index("ix_audit_timestamp", "timestamp"),
        Index("ix_audit_username", "username"),
    )


# ── Notifications ──────────────────────────────────────────────────────────

class NotificationConfig(Base):
    __tablename__ = "notification_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    channel = Column(String(20), nullable=False)
    enabled = Column(Boolean, default=True)
    config_json = Column(JSON, default=dict)
    min_severity = Column(String(20), default="High")
    created_at = Column(DateTime, default=datetime.utcnow)


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    channel = Column(String(20), nullable=False)
    alert_id = Column(String(20), nullable=True)
    recipient = Column(String(200), nullable=True)
    subject = Column(String(200), nullable=True)
    message = Column(Text, nullable=True)
    sent_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default="sent")
    error_message = Column(Text, nullable=True)


# ── MITRE ATT&CK ───────────────────────────────────────────────────────────

class MITREMapping(Base):
    __tablename__ = "mitre_attack_mappings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    technique_id = Column(String(20), nullable=False, index=True)
    technique_name = Column(String(200), nullable=False)
    tactic = Column(String(100), nullable=False)
    detection_feature = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    severity_boost = Column(Float, default=0.0)


# ── Model Retraining ───────────────────────────────────────────────────────

class OTPVerification(Base):
    """Store pending registrations with OTP codes for email verification."""
    __tablename__ = "otp_verifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(100), nullable=False, index=True)
    otp_code = Column(String(6), nullable=False)
    username = Column(String(50), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=True)
    role = Column(String(20), default="Analyst")
    expires_at = Column(DateTime, nullable=False)
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ModelTrainingLog(Base):
    __tablename__ = "model_training_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    version = Column(Integer, nullable=False)
    trained_at = Column(DateTime, default=datetime.utcnow)
    training_days = Column(Integer, nullable=True)
    users_trained = Column(Integer, nullable=True)
    total_samples = Column(Integer, nullable=True)
    contamination = Column(Float, default=0.06)
    model_params = Column(JSON, default=dict)
    performance_metrics = Column(JSON, default=dict)
    triggered_by = Column(String(50), default="auto")
    status = Column(String(20), default="completed")
    error_message = Column(Text, nullable=True)

"""
Role-Based Access Control module.

Provides real JWT authentication (via PyJWT), bcrypt password hashing,
user management, role-based authorization, and token revocation support.

ALL secrets come from environment variables (loaded via .env).
"""

import os
import logging
import jwt
import bcrypt
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session_factory
from models import SOCUser, UserRole, AuditLog

logger = logging.getLogger(__name__)

# ── All config from env ──────────────────────────────────────────────────
SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
if not SECRET_KEY:
    SECRET_KEY = secrets.token_hex(32)
    logger.warning("JWT_SECRET_KEY not set in .env! Using a random key. "
                   "All existing tokens will become invalid on server restart.")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("JWT_ACCESS_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get("JWT_REFRESH_EXPIRE_DAYS", "7"))

# Default admin credentials (REQUIRED via .env)
DEFAULT_ADMIN_PASSWORD = os.environ.get("DEFAULT_ADMIN_PASSWORD")
DEFAULT_ADMIN_EMAIL = os.environ.get("DEFAULT_ADMIN_EMAIL", "admin@soc.local")
DEFAULT_ADMIN_NAME = os.environ.get("DEFAULT_ADMIN_NAME", "Default Admin")

security = HTTPBearer(auto_error=False)

# Revoked tokens set (in production, use Redis)
_revoked_tokens: set[str] = set()


def _hash_password(password: str) -> str:
    """Hash a password using bcrypt (slow, salt built-in)."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(username: str, role: str) -> str:
    """Create a real JWT access token."""
    now = datetime.utcnow()
    payload = {
        "sub": username,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(username: str, role: str) -> str:
    """Create a JWT refresh token (longer lived)."""
    now = datetime.utcnow()
    payload = {
        "sub": username,
        "role": role,
        "iat": now,
        "exp": now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token. Raises if invalid/expired/revoked."""
    if token in _revoked_tokens:
        raise HTTPException(status_code=401, detail="Token revoked")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def revoke_token(token: str) -> None:
    """Add a token to the revocation set."""
    _revoked_tokens.add(token)


async def initialize_default_admin():
    """Create default admin user if no users exist."""
    if not DEFAULT_ADMIN_PASSWORD:
        raise RuntimeError(
            "DEFAULT_ADMIN_PASSWORD is not set in .env! "
            "This is required to create the initial admin account. "
            "Add it to your .env file and restart."
        )
    async with async_session_factory() as session:
        result = await session.execute(select(SOCUser).limit(1))
        if result.scalar_one_or_none() is None:
            admin = SOCUser(
                username="admin",
                email=DEFAULT_ADMIN_EMAIL,
                hashed_password=_hash_password(DEFAULT_ADMIN_PASSWORD),
                full_name=DEFAULT_ADMIN_NAME,
                role=UserRole.ADMIN.value,
                is_active=True,
            )
            session.add(admin)
            await session.commit()


async def authenticate_user(email: str, password: str) -> Optional[dict]:
    """Authenticate a user by email and return user info + tokens."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(SOCUser).where(SOCUser.email == email)
        )
        user = result.scalar_one_or_none()
        if not user or not _verify_password(password, user.hashed_password):
            return None
        if not user.is_active:
            return None

        access_token = create_access_token(user.username, user.role)
        refresh_token = create_refresh_token(user.username, user.role)
        user.last_login = datetime.utcnow()
        await session.commit()

        return {
            "token": access_token,
            "refresh_token": refresh_token,
            "username": user.username,
            "role": user.role,
            "full_name": user.full_name,
        }


async def refresh_access_token(refresh_token: str) -> Optional[dict]:
    """Exchange a refresh token for a new access token."""
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            return None
        username = payload["sub"]
        role = payload["role"]
        new_access = create_access_token(username, role)
        return {"token": new_access, "username": username, "role": role}
    except HTTPException:
        return None


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """Dependency: extract and validate the current user from JWT."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    payload = decode_token(credentials.credentials)
    return {
        "username": payload["sub"],
        "role": payload["role"],
    }


def require_role(*roles: str):
    """Dependency factory: require one of the specified roles."""
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of: {', '.join(roles)}",
            )
        return current_user
    return role_checker


# Pre-defined role requirements
require_admin = require_role(UserRole.ADMIN.value)
require_analyst = require_role(UserRole.ADMIN.value, UserRole.ANALYST.value)
require_any = require_role(UserRole.ADMIN.value, UserRole.ANALYST.value, UserRole.VIEWER.value)


async def log_audit(
    username: str,
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
):
    """Record an audit log entry."""
    async with async_session_factory() as session:
        log = AuditLog(
            username=username,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details or {},
            ip_address=ip_address,
        )
        session.add(log)
        await session.commit()


async def create_user(
    username: str,
    email: str,
    password: str,
    role: str = UserRole.ANALYST.value,
    full_name: Optional[str] = None,
) -> dict:
    """Create a new SOC user."""
    async with async_session_factory() as session:
        existing = await session.execute(
            select(SOCUser).where(
                (SOCUser.username == username) | (SOCUser.email == email)
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Username or email already exists")

        user = SOCUser(
            username=username,
            email=email,
            hashed_password=_hash_password(password),
            full_name=full_name,
            role=role,
        )
        session.add(user)
        await session.commit()
        return {"username": user.username, "email": user.email, "role": user.role}

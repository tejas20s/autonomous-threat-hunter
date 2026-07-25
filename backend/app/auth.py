"""
Role-Based Access Control module.

Provides JWT authentication, user management, and role-based authorization
for Admin, Security Analyst, and Viewer roles.
"""

import os
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session_factory
from models import SOCUser, UserRole, AuditLog

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", secrets.token_hex(32))
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

security = HTTPBearer(auto_error=False)

# Simple token store (in production, use Redis or DB)
_active_tokens: dict[str, dict] = {}


def _hash_password(password: str) -> str:
    """Hash a password using SHA-256 with salt."""
    salt = secrets.token_hex(16)
    return f"{salt}:{hashlib.sha256((salt + password).encode()).hexdigest()}"


def _verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash."""
    salt, h = hashed.split(":", 1)
    return h == hashlib.sha256((salt + password).encode()).hexdigest()


async def initialize_default_admin():
    """Create default admin user if no users exist."""
    default_password = os.environ.get("DEFAULT_ADMIN_PASSWORD", "admin123")
    async with async_session_factory() as session:
        result = await session.execute(select(SOCUser).limit(1))
        if result.scalar_one_or_none() is None:
            admin = SOCUser(
                username="admin",
                email="admin@soc.local",
                hashed_password=_hash_password(default_password),
                full_name="Default Admin",
                role=UserRole.ADMIN.value,
                is_active=True,
            )
            session.add(admin)
            await session.commit()


def create_token(username: str, role: str) -> str:
    """Create a simple bearer token."""
    token = secrets.token_hex(32)
    _active_tokens[token] = {
        "username": username,
        "role": role,
        "expires": (datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)).isoformat(),
    }
    return token


async def authenticate_user(username: str, password: str) -> Optional[dict]:
    """Authenticate a user and return user info + token."""
    async with async_session_factory() as session:
        result = await session.execute(
            select(SOCUser).where(SOCUser.username == username)
        )
        user = result.scalar_one_or_none()
        if not user or not _verify_password(password, user.hashed_password):
            return None
        if not user.is_active:
            return None

        token = create_token(user.username, user.role)
        user.last_login = datetime.utcnow()
        await session.commit()

        return {
            "token": token,
            "username": user.username,
            "role": user.role,
            "full_name": user.full_name,
        }


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """Dependency: extract and validate the current user from the token."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    token = credentials.credentials
    if token not in _active_tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    user_data = _active_tokens[token]
    expires = datetime.fromisoformat(user_data["expires"])
    if datetime.utcnow() > expires:
        del _active_tokens[token]
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        )
    return user_data


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

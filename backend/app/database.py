"""
Database connection and session management.

Supports PostgreSQL (via asyncpg) in production and SQLite (via aiosqlite)
for local development. Set the DATABASE_URL environment variable to switch:

  export DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/insider_threat

Defaults to a local SQLite file at backend/data/threat.db when not set.
"""

import os
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DEFAULT_DB_DIR = Path(__file__).parent.parent / "data"
DEFAULT_DB_DIR.mkdir(parents=True, exist_ok=True)

# On Windows, SQLite URLs must use forward slashes for absolute paths.
_db_path = DEFAULT_DB_DIR / "threat.db"
_sqlite_url = f"sqlite+aiosqlite:///{_db_path.as_posix()}"

DATABASE_URL = os.environ.get("DATABASE_URL", _sqlite_url)

engine = create_async_engine(DATABASE_URL, echo=False)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

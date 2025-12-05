import os
from typing import Generator, Optional

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

USE_IN_MEMORY_STORAGE = os.getenv("USE_IN_MEMORY_STORAGE", "false").lower() == "true"
database_url: Optional[str] = os.getenv("DATABASE_URL")

engine = None
SessionLocal = None
Base = declarative_base()

if not USE_IN_MEMORY_STORAGE:
    if not database_url:
        raise ValueError("DATABASE_URL environment variable is not set")
    engine = create_engine(database_url, future=True, pool_pre_ping=True)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


def get_db() -> Generator:
    """Yield a SQLAlchemy session and ensure proper cleanup."""
    if USE_IN_MEMORY_STORAGE:
        # In-memory mode: no DB session needed.
        yield None
        return

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

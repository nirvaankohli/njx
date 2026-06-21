from __future__ import annotations

import os

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker


DATABASE_URL = os.getenv("DOCSHIELD_DATABASE_URL", "sqlite:///./docshield.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    from app.models import db  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _migrate_document_content_table()
    columns = {column["name"] for column in inspect(engine).get_columns("access_events")}
    if "browser" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE access_events ADD COLUMN browser VARCHAR"))
    if "ip_address" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE access_events ADD COLUMN ip_address VARCHAR"))


def _migrate_document_content_table() -> None:
    columns = {column["name"] for column in inspect(engine).get_columns("document_contents")}
    with engine.begin() as connection:
        if "storage_key" not in columns:
            connection.execute(text("ALTER TABLE document_contents ADD COLUMN storage_key VARCHAR"))
        if "encrypted_size_bytes" not in columns:
            connection.execute(text("ALTER TABLE document_contents ADD COLUMN encrypted_size_bytes INTEGER"))

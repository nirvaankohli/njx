from __future__ import annotations

import shutil
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BASE_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BASE_DIR / ".pytest" / "docshield-test.db"
BLOB_PATH = BASE_DIR / ".pytest" / "blob-store"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
if DB_PATH.exists():
    DB_PATH.unlink()

os.environ["DOCSHIELD_DATABASE_URL"] = f"sqlite:///{DB_PATH}"
os.environ["DOCSHIELD_BLOB_STORAGE_DIR"] = str(BLOB_PATH)

from app.db.session import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    shutil.rmtree(BLOB_PATH, ignore_errors=True)
    yield
    shutil.rmtree(BLOB_PATH, ignore_errors=True)
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client

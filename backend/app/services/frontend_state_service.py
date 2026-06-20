from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

STATE_PATH = Path(__file__).resolve().parents[2] / ".frontend-state.json"
STATE_LOCK = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _seed_state() -> dict[str, Any]:
    user = {
        "id": "demo-user",
        "email": "demo@acme.com",
        "full_name": "DocShield Demo",
        "job_title": "Security Lead",
        "avatar_url": None,
    }
    company = {
        "id": "company-demo",
        "user_id": user["id"],
        "company_name": "Acme Pharma",
        "company_website": "https://acme.example",
        "company_size": "50-200",
        "industry": "Pharma",
        "address": "1 Demo Way",
        "phone": None,
        "company_logo_url": None,
        "created_at": _now(),
        "updated_at": _now(),
    }
    return {
        "signed_out": False,
        "current_user": user,
        "company_settings": company,
    }


def _load_state() -> dict[str, Any]:
    if not STATE_PATH.exists():
        return _seed_state()
    try:
        return json.loads(STATE_PATH.read_text())
    except Exception:
        return _seed_state()


def _save_state(state: dict[str, Any]) -> None:
    STATE_PATH.write_text(json.dumps(state, indent=2, sort_keys=True))


def _maybe_seed_company(state: dict[str, Any], user: dict[str, Any]) -> dict[str, Any]:
    company = state.get("company_settings")
    if company and company.get("user_id") == user["id"]:
        return company
    return {
        "id": f"company-{user['id']}",
        "user_id": user["id"],
        "company_name": user.get("full_name") or "Acme Pharma",
        "company_website": None,
        "company_size": None,
        "industry": None,
        "address": None,
        "phone": None,
        "company_logo_url": None,
        "created_at": _now(),
        "updated_at": _now(),
    }


def _user_from_email(email: str, full_name: str | None = None) -> dict[str, Any]:
    seed = str(uuid.uuid5(uuid.NAMESPACE_URL, email))
    return {
        "id": seed,
        "email": email,
        "full_name": full_name or email.split("@")[0] or "DocShield Demo",
        "job_title": "Security Lead",
        "avatar_url": None,
    }


def get_frontend_session() -> dict[str, Any]:
    with STATE_LOCK:
        state = _load_state()
        if state.get("signed_out"):
            return {"user": None, "profile": None, "company_settings": state.get("company_settings")}
        user = state.get("current_user")
        if not user:
            state = _seed_state()
            _save_state(state)
            user = state["current_user"]
        company = state.get("company_settings")
        if not company or company.get("user_id") != user["id"]:
            company = _maybe_seed_company(state, user)
            state["company_settings"] = company
            _save_state(state)
        return {
            "user": user,
            "profile": user,
            "company_settings": company,
        }


def sign_in_frontend_session(email: str, full_name: str | None = None) -> dict[str, Any]:
    with STATE_LOCK:
        state = _load_state()
        user = _user_from_email(email, full_name)
        state["signed_out"] = False
        state["current_user"] = user
        state["company_settings"] = _maybe_seed_company(state, user)
        _save_state(state)
        return {
            "user": user,
            "profile": user,
            "company_settings": state["company_settings"],
        }


def sign_out_frontend_session() -> dict[str, Any]:
    with STATE_LOCK:
        state = _load_state()
        state["signed_out"] = True
        state["current_user"] = None
        _save_state(state)
        return {"ok": True}


def get_company_settings() -> dict[str, Any] | None:
    session = get_frontend_session()
    return session.get("company_settings")


def upsert_company_settings(payload: dict[str, Any]) -> dict[str, Any]:
    with STATE_LOCK:
        state = _load_state()
        user = state.get("current_user") or _seed_state()["current_user"]
        now = _now()
        current = state.get("company_settings") or {}
        company = {
            "id": current.get("id") or f"company-{user['id']}",
            "user_id": user["id"],
            "company_name": payload.get("company_name") or current.get("company_name") or user.get("full_name") or "Acme Pharma",
            "company_website": payload.get("company_website") if "company_website" in payload else current.get("company_website"),
            "company_size": payload.get("company_size") if "company_size" in payload else current.get("company_size"),
            "industry": payload.get("industry") if "industry" in payload else current.get("industry"),
            "address": payload.get("address") if "address" in payload else current.get("address"),
            "phone": payload.get("phone") if "phone" in payload else current.get("phone"),
            "company_logo_url": payload.get("company_logo_url") if "company_logo_url" in payload else current.get("company_logo_url"),
            "created_at": current.get("created_at") or now,
            "updated_at": now,
        }
        state["company_settings"] = company
        state["signed_out"] = False
        state["current_user"] = user
        _save_state(state)
        return company

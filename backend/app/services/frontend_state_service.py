from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.security.passwords import hash_password, hash_session_token, new_session_token, verify_password

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
        "users": {},
        "sessions": {},
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


def _public_user(account: dict[str, Any]) -> dict[str, Any]:
    return {key: account.get(key) for key in ("id", "email", "full_name", "job_title", "avatar_url")}


def _create_account(state: dict[str, Any], email: str, password: str, full_name: str | None) -> dict[str, Any]:
    normalized_email = email.strip().lower()
    users = state.setdefault("users", {})
    if normalized_email in users:
        raise ValueError("An account with this email already exists")
    salt, password_hash = hash_password(password)
    account = {
        **_user_from_email(normalized_email, full_name),
        "password_salt": salt,
        "password_hash": password_hash,
    }
    users[normalized_email] = account
    return account


def _authenticate(state: dict[str, Any], email: str, password: str) -> dict[str, Any]:
    account = state.setdefault("users", {}).get(email.strip().lower())
    if not account or not verify_password(password, account["password_salt"], account["password_hash"]):
        raise ValueError("Invalid email or password")
    return account


def _start_session(state: dict[str, Any], account: dict[str, Any]) -> str:
    token = new_session_token()
    state.setdefault("sessions", {})[hash_session_token(token)] = account["email"]
    return token


def _session_payload(state: dict[str, Any], account: dict[str, Any] | None) -> dict[str, Any]:
    if not account:
        return {"user": None, "profile": None, "company_settings": None}
    user = _public_user(account)
    company = state.get("company_settings")
    if company and company.get("user_id") != user["id"]:
        company = None
    return {"user": user, "profile": user, "company_settings": company}


def _account_for_session(state: dict[str, Any], token: str | None) -> dict[str, Any] | None:
    if not token:
        return None
    email = state.setdefault("sessions", {}).get(hash_session_token(token))
    return state.setdefault("users", {}).get(email) if email else None


def get_frontend_session(token: str | None) -> dict[str, Any]:
    with STATE_LOCK:
        state = _load_state()
        return _session_payload(state, _account_for_session(state, token))


def sign_up_frontend_session(email: str, password: str, full_name: str | None = None) -> tuple[dict[str, Any], str]:
    with STATE_LOCK:
        state = _load_state()
        account = _create_account(state, email, password, full_name)
        token = _start_session(state, account)
        _save_state(state)
        return _session_payload(state, account), token


def sign_in_frontend_session(email: str, password: str) -> tuple[dict[str, Any], str]:
    with STATE_LOCK:
        state = _load_state()
        account = _authenticate(state, email, password)
        token = _start_session(state, account)
        _save_state(state)
        return _session_payload(state, account), token


def sign_out_frontend_session(token: str | None) -> dict[str, Any]:
    with STATE_LOCK:
        state = _load_state()
        if token:
            state.setdefault("sessions", {}).pop(hash_session_token(token), None)
            _save_state(state)
        return {"ok": True}


def get_company_settings(token: str | None) -> dict[str, Any] | None:
    session = get_frontend_session(token)
    return session.get("company_settings")


def upsert_company_settings(token: str | None, payload: dict[str, Any]) -> dict[str, Any]:
    with STATE_LOCK:
        state = _load_state()
        account = _account_for_session(state, token)
        if not account:
            raise ValueError("Authentication required")
        user = _public_user(account)
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
        _save_state(state)
        return company

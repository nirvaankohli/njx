from __future__ import annotations

import pytest

from app.services import frontend_state_service


@pytest.fixture(autouse=True)
def isolated_frontend_state(tmp_path, monkeypatch):
    monkeypatch.setattr(frontend_state_service, "STATE_PATH", tmp_path / "frontend-state.json")


def test_signup_persists_session_in_cookie(client):
    response = client.post(
        "/frontend/auth/sign-up",
        json={"email": "user@example.com", "password": "secret123", "full_name": "Test User"},
    )

    assert response.status_code == 200
    assert response.json()["user"]["email"] == "user@example.com"
    assert "docshield_session=" in response.headers["set-cookie"]
    assert "HttpOnly" in response.headers["set-cookie"]

    restored = client.get("/frontend/session")
    assert restored.status_code == 200
    assert restored.json()["user"]["full_name"] == "Test User"


def test_signin_rejects_wrong_password(client):
    client.post(
        "/frontend/auth/sign-up",
        json={"email": "user@example.com", "password": "secret123", "full_name": "Test User"},
    )
    client.delete("/frontend/session")

    response = client.post(
        "/frontend/auth/sign-in",
        json={"email": "user@example.com", "password": "incorrect"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"


def test_signout_invalidates_session(client):
    client.post(
        "/frontend/auth/sign-up",
        json={"email": "user@example.com", "password": "secret123", "full_name": "Test User"},
    )

    assert client.delete("/frontend/session").status_code == 200
    assert client.get("/frontend/session").json()["user"] is None


def test_demo_signin_bootstraps_known_session(client):
    response = client.post("/frontend/auth/demo")

    assert response.status_code == 200
    assert response.json()["user"]["email"] == "demo@acme.com"
    assert "docshield_session=" in response.headers["set-cookie"]
    assert client.get("/frontend/session").json()["user"]["email"] == "demo@acme.com"

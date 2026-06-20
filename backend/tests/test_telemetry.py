from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.models.dto import ManifestClaims, SignatureHistoryEvent

from .helpers import manifest_hash_for, make_keypair, signed_event_payload, signed_manifest_payload


def _register_document(client):
    public_key_b64, private_key = make_keypair()
    client.post(
        "/setup",
        json={
            "tenant": {
                "tenant_id": "tenant_acme",
                "org_name": "Acme Pharma",
                "domains": ["acme.com"],
                "admin_emails": ["admin@acme.com"],
            },
            "policy_templates": [],
            "public_keys": [
                {
                    "key_id": "key_acme_primary",
                    "algorithm": "Ed25519",
                    "public_key_b64": public_key_b64,
                    "status": "active",
                }
            ],
        },
    )
    manifest = ManifestClaims(
        tenant_id="tenant_acme",
        document_id="doc_telemetry",
        issuer_key_id="key_acme_primary",
        content_fingerprint="sha256:telemetry",
        policy={"external_ai_upload": "blocked"},
        embedded_ai_tags=["NO_EXTERNAL_AI"],
        created_at="2026-06-20T18:30:00Z",
    )
    manifest_hash = manifest_hash_for(manifest)
    signed_manifest = signed_manifest_payload(manifest, private_key)
    initial_event = SignatureHistoryEvent(
        event_id="evt_issued_001",
        document_id="doc_telemetry",
        event="issued",
        actor_org="SupplierCo",
        actor_key_id="key_acme_primary",
        timestamp="2026-06-20T18:30:00Z",
        previous_event_hash=None,
        manifest_hash=manifest_hash,
        payload={},
        signature="",
    )
    client.post(
        "/documents",
        json={"signed_manifest": signed_manifest, "initial_history": [signed_event_payload(initial_event, private_key)]},
    )
    return private_key, manifest, signed_manifest


def test_telemetry_dashboard_and_audit_export(client):
    _, manifest, _ = _register_document(client)
    base_time = datetime(2026, 6, 20, 20, 0, tzinfo=timezone.utc)
    for index in range(10):
        response = client.post(
            "/access-events",
            json={
                "event_id": f"acc_{index:03d}",
                "tenant_id": "tenant_acme",
                "document_id": "doc_telemetry",
                "link_id": "link_buyerco_001",
                "timestamp": (base_time + timedelta(minutes=index)).isoformat().replace("+00:00", "Z"),
                "action": "download",
                "ip_hash": f"sha256:ip{index}",
                "user_agent_hash": f"sha256:ua{index}",
                "country": "US" if index % 2 == 0 else "CA",
                "result": "allowed",
                "reason": None,
            },
        )
        assert response.status_code == 200

    dashboard_response = client.get("/dashboard", params={"tenant_id": "tenant_acme"})
    assert dashboard_response.status_code == 200
    dashboard = dashboard_response.json()
    assert dashboard["documents"] == 1
    assert dashboard["access_events"] == 10
    assert dashboard["alerts"]
    assert dashboard["alerts"][0]["document_id"] == "doc_telemetry"

    audit_response = client.get("/audit-export", params={"tenant_id": "tenant_acme", "document_id": "doc_telemetry"})
    assert audit_response.status_code == 200
    audit = audit_response.json()
    assert audit["tenant_id"] == "tenant_acme"
    assert audit["document_id"] == "doc_telemetry"
    assert audit["manifest"]["document_id"] == manifest.document_id
    assert audit["manifest_hash"].startswith("sha256:")
    assert audit["history"]
    assert audit["access_events"]
    assert audit["verification_summary"]["last_status"] is None


from __future__ import annotations

from app.models.dto import ManifestClaims, SignatureHistoryEvent

from .helpers import manifest_hash_for, make_keypair, signed_event_payload, signed_manifest_payload


def test_rejects_history_event_with_wrong_previous_hash(client):
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
        document_id="doc_bad_chain",
        issuer_key_id="key_acme_primary",
        content_fingerprint="sha256:abcd",
        policy={"external_ai_upload": "blocked"},
        embedded_ai_tags=["NO_EXTERNAL_AI"],
        created_at="2026-06-20T18:30:00Z",
    )
    manifest_hash = manifest_hash_for(manifest)
    signed_manifest = signed_manifest_payload(manifest, private_key)

    initial_event = SignatureHistoryEvent(
        event_id="evt_issued_001",
        document_id="doc_bad_chain",
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
        json={
            "signed_manifest": signed_manifest,
            "initial_history": [signed_event_payload(initial_event, private_key)],
        },
    )

    bad_event = SignatureHistoryEvent(
        event_id="evt_confirmed_002",
        document_id="doc_bad_chain",
        event="confirmed_received",
        actor_org="BuyerCo",
        actor_key_id="key_acme_primary",
        timestamp="2026-06-20T19:10:00Z",
        previous_event_hash="sha256:not-the-tip",
        manifest_hash=manifest_hash,
        payload={},
        signature="",
    )
    response = client.post("/documents/doc_bad_chain/events", json=signed_event_payload(bad_event, private_key))

    assert response.status_code == 409
    assert "previous_event_hash" in response.json()["detail"]

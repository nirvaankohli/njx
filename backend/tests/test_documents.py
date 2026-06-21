from __future__ import annotations

from app.models.dto import DocumentRegistrationRequest, ManifestClaims, SignatureHistoryEvent

from .helpers import manifest_hash_for, make_keypair, signed_event_payload, signed_manifest_payload


def _setup_tenant(client, public_key_b64: str) -> None:
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


def test_register_document_and_append_history_event(client):
    public_key_b64, private_key = make_keypair()
    _setup_tenant(client, public_key_b64)

    manifest = ManifestClaims(
        tenant_id="tenant_acme",
        document_id="doc_7f92ab31",
        issuer_key_id="key_acme_primary",
        content_fingerprint="sha256:1234",
        policy={
            "external_ai_upload": "blocked",
            "secure_link_required": True,
            "forwarding": "blocked",
            "public_sharing": "blocked",
        },
        embedded_ai_tags=["NO_EXTERNAL_AI"],
        created_at="2026-06-20T18:30:00Z",
    )
    signed_manifest = signed_manifest_payload(manifest, private_key)
    manifest_hash = manifest_hash_for(manifest)

    initial_event = SignatureHistoryEvent(
        event_id="evt_issued_001",
        document_id="doc_7f92ab31",
        event="issued",
        actor_org="SupplierCo",
        actor_key_id="key_acme_primary",
        timestamp="2026-06-20T18:30:00Z",
        previous_event_hash=None,
        manifest_hash=manifest_hash,
        payload={},
        signature="",
    )
    signed_initial_event = signed_event_payload(initial_event, private_key)

    register_response = client.post(
        "/documents",
        json=DocumentRegistrationRequest(
            signed_manifest=signed_manifest,
            initial_history=[SignatureHistoryEvent(**signed_initial_event)],
        ).model_dump(mode="json"),
    )

    assert register_response.status_code == 200
    assert register_response.json()["document_id"] == "doc_7f92ab31"
    assert register_response.json()["manifest_hash"] == manifest_hash

    append_event = SignatureHistoryEvent(
        event_id="evt_confirmed_002",
        document_id="doc_7f92ab31",
        event="confirmed_received",
        actor_org="BuyerCo",
        actor_key_id="key_acme_primary",
        timestamp="2026-06-20T19:10:00Z",
        previous_event_hash=register_response.json()["history_tip"],
        manifest_hash=manifest_hash,
        payload={"note": "Buyer confirmed receipt"},
        signature="",
    )
    signed_append_event = signed_event_payload(append_event, private_key)

    append_response = client.post("/documents/doc_7f92ab31/events", json=signed_append_event)

    assert append_response.status_code == 200
    assert append_response.json()["accepted"] is True
    assert append_response.json()["document_id"] == "doc_7f92ab31"


def test_list_get_filter_and_delete_document(client):
    public_key_b64, private_key = make_keypair()
    _setup_tenant(client, public_key_b64)
    manifest = ManifestClaims(
        tenant_id="tenant_acme",
        document_id="doc_manageable",
        issuer_key_id="key_acme_primary",
        content_fingerprint="sha256:manageable",
        policy={"external_ai_upload": "blocked"},
        embedded_ai_tags=["NO_EXTERNAL_AI"],
        created_at="2026-06-20T18:30:00Z",
    )
    initial_event = SignatureHistoryEvent(
        event_id="evt_manageable",
        document_id=manifest.document_id,
        event="issued",
        actor_org="Acme Pharma",
        actor_key_id="key_acme_primary",
        timestamp="2026-06-20T18:30:00Z",
        previous_event_hash=None,
        manifest_hash=manifest_hash_for(manifest),
        payload={"file_name": "quarterly-report.pdf"},
        signature="",
    )
    register = client.post(
        "/documents",
        json={
            "signed_manifest": signed_manifest_payload(manifest, private_key),
            "initial_history": [signed_event_payload(initial_event, private_key)],
        },
    )
    assert register.status_code == 200

    listed = client.get("/documents", params={"tenant_id": "tenant_acme"})
    assert listed.status_code == 200
    assert listed.json()[0]["document_id"] == "doc_manageable"
    assert listed.json()[0]["event_count"] == 1

    searched = client.get(
        "/documents",
        params={"tenant_id": "tenant_acme", "query": "manage", "status": "active"},
    )
    assert len(searched.json()) == 1
    assert client.get(
        "/documents", params={"tenant_id": "tenant_acme", "status": "revoked"}
    ).json() == []

    detail = client.get("/documents/doc_manageable", params={"tenant_id": "tenant_acme"})
    assert detail.status_code == 200
    assert detail.json()["manifest_hash"] == register.json()["manifest_hash"]
    assert [event["event_id"] for event in detail.json()["history"]] == ["evt_manageable"]

    removed = client.delete("/documents/doc_manageable", params={"tenant_id": "tenant_acme"})
    assert removed.status_code == 204
    assert client.get("/documents", params={"tenant_id": "tenant_acme"}).json() == []
    assert client.get(
        "/documents/doc_manageable", params={"tenant_id": "tenant_acme"}
    ).status_code == 404

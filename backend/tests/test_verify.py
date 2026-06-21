from __future__ import annotations

from pathlib import Path

from app.models.dto import ManifestClaims, SignatureHistoryEvent
from app.security.hashes import sha256_hex

from .helpers import file_hash_for, manifest_hash_for, make_keypair, signed_event_payload, signed_manifest_payload


def _register_document(client, content_fingerprint: str = "sha256:verified"):
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
        document_id="doc_verify",
        issuer_key_id="key_acme_primary",
        content_fingerprint=content_fingerprint,
        policy={
            "external_ai_upload": "blocked",
            "secure_link_required": True,
            "forwarding": "blocked",
            "public_sharing": "blocked",
        },
        embedded_ai_tags=["NO_EXTERNAL_AI"],
        created_at="2026-06-20T18:30:00Z",
    )
    manifest_hash = manifest_hash_for(manifest)
    signed_manifest = signed_manifest_payload(manifest, private_key)
    initial_event = SignatureHistoryEvent(
        event_id="evt_issued_001",
        document_id="doc_verify",
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
        json={"signed_manifest": signed_manifest, "initial_history": [signed_initial_event]},
    )
    return private_key, manifest, signed_manifest, manifest_hash, signed_initial_event, register_response.json()["history_tip"]


def test_verify_valid_document_and_policy_block(client):
    private_key, manifest, signed_manifest, manifest_hash, signed_initial_event, history_tip = _register_document(client)
    second_event = SignatureHistoryEvent(
        event_id="evt_confirmed_002",
        document_id="doc_verify",
        event="confirmed_received",
        actor_org="BuyerCo",
        actor_key_id="key_acme_primary",
        timestamp="2026-06-20T19:10:00Z",
        previous_event_hash=history_tip,
        manifest_hash=manifest_hash,
        payload={"note": "Buyer confirmed receipt"},
        signature="",
    )
    signed_second_event = signed_event_payload(second_event, private_key)
    client.post("/documents/doc_verify/events", json=signed_second_event)

    response = client.post(
        "/verify",
        json={
            "document_id": "doc_verify",
            "signed_manifest": signed_manifest,
            "history": [signed_initial_event, signed_second_event],
            "computed_content_fingerprint": manifest.content_fingerprint,
            "usage_context": {
                "operation": "external_ai_upload",
                "app": "reference_ai_gateway",
            },
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "valid"
    assert body["fingerprint_match"] is True
    assert body["manifest_signature_valid"] is True
    assert body["signature_chain_valid"] is True
    assert body["policy_decision"]["allowed"] is False
    assert body["policy_decision"]["reason"] == "NO_EXTERNAL_AI"


def test_verify_unknown_document(client):
    public_key_b64, private_key = make_keypair()
    signed_manifest = signed_manifest_payload(
        ManifestClaims(
            tenant_id="tenant_acme",
            document_id="missing_doc",
            issuer_key_id="key_missing",
            content_fingerprint="sha256:none",
            policy={},
            embedded_ai_tags=[],
            created_at="2026-06-20T18:30:00Z",
        ),
        private_key,
    )

    response = client.post(
        "/verify",
        json={
            "document_id": "missing_doc",
            "signed_manifest": signed_manifest,
            "history": [],
            "computed_content_fingerprint": "sha256:none",
            "usage_context": {"operation": "external_ai_upload", "app": "reference_ai_gateway"},
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "unknown_document"


def test_verify_signed_manifest_for_pdf_fixture(client):
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

    pdf_path = Path(__file__).resolve().parent / "fixtures" / "invoice-template-us-neat-750px.pdf"
    pdf_fingerprint = file_hash_for(pdf_path)
    manifest = ManifestClaims(
        tenant_id="tenant_acme",
        document_id="doc_invoice_pdf",
        issuer_key_id="key_acme_primary",
        content_fingerprint=pdf_fingerprint,
        policy={
            "external_ai_upload": "blocked",
            "secure_link_required": True,
            "forwarding": "blocked",
            "public_sharing": "blocked",
        },
        embedded_ai_tags=["NO_EXTERNAL_AI"],
        created_at="2026-06-20T18:30:00Z",
    )
    manifest_hash = manifest_hash_for(manifest)
    signed_manifest = signed_manifest_payload(manifest, private_key)
    initial_event = SignatureHistoryEvent(
        event_id="evt_issued_001",
        document_id="doc_invoice_pdf",
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
        json={"signed_manifest": signed_manifest, "initial_history": [signed_initial_event]},
    )
    assert register_response.status_code == 200

    verify_response = client.post(
        "/verify",
        json={
            "document_id": "doc_invoice_pdf",
            "signed_manifest": signed_manifest,
            "history": [signed_initial_event],
            "computed_content_fingerprint": pdf_fingerprint,
            "usage_context": {"operation": "direct_share", "app": "pdf_verifier"},
        },
    )

    assert verify_response.status_code == 200
    body = verify_response.json()
    assert body["status"] == "valid"
    assert body["fingerprint_match"] is True
    assert body["manifest_signature_valid"] is True
    assert body["signature_chain_valid"] is True

    upload_response = client.post(
        "/verify/file?operation=authenticity_check&app=upload_test",
        content=pdf_path.read_bytes(),
        headers={"Content-Type": "application/octet-stream"},
    )
    assert upload_response.status_code == 200
    upload_body = upload_response.json()
    assert upload_body["status"] == "valid"
    assert upload_body["document_id"] == "doc_invoice_pdf"
    assert upload_body["issuer_key_id"] == "key_acme_primary"
    assert upload_body["fingerprint_match"] is True
    assert upload_body["manifest_signature_valid"] is True
    assert upload_body["signature_chain_valid"] is True


def test_verify_uploaded_file_rejects_unregistered_bytes(client):
    response = client.post(
        "/verify/file",
        content=b"this is not a registered document",
        headers={"Content-Type": "application/octet-stream"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "unknown_document"
    assert body["manifest_signature_valid"] is False
    assert body["policy_decision"]["reason"] == "FINGERPRINT_NOT_REGISTERED"


def test_verify_uploaded_file_rejects_empty_body(client):
    response = client.post(
        "/verify/file",
        content=b"",
        headers={"Content-Type": "application/octet-stream"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Uploaded file is empty"


def test_verify_uploaded_file_rejects_wrong_issuer_key(client):
    file_bytes = b"verified"
    _register_document(client, sha256_hex(file_bytes))
    replacement_public_key, _ = make_keypair()
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
            "public_keys": [{
                "key_id": "key_acme_primary",
                "algorithm": "Ed25519",
                "public_key_b64": replacement_public_key,
                "status": "active",
            }],
        },
    )

    response = client.post("/verify/file", content=file_bytes)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "invalid_signature"
    assert body["manifest_signature_valid"] is False
    assert body["issuer_key_id"] == "key_acme_primary"

from __future__ import annotations

from app.models.dto import ManifestClaims, SignatureHistoryEvent
from app.security.hashes import sha256_hex
from app.services.embedded_document_service import TRAILER_MAGIC

from .helpers import manifest_hash_for, make_keypair, signed_event_payload, signed_manifest_payload


def _register_original(client, content: bytes = b"signed agreement bytes") -> tuple[str, bytes]:
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
            "public_keys": [{
                "key_id": "key_acme_primary",
                "algorithm": "Ed25519",
                "public_key_b64": public_key_b64,
                "status": "active",
            }],
        },
    )
    manifest = ManifestClaims(
        tenant_id="tenant_acme",
        document_id="doc_share_flow",
        issuer_key_id="key_acme_primary",
        content_fingerprint=sha256_hex(content),
        policy={"secure_link_required": True, "public_sharing": "allowed"},
        embedded_ai_tags=["SECURE_LINK_ONLY"],
        created_at="2026-06-20T18:30:00Z",
    )
    event = SignatureHistoryEvent(
        event_id="evt_issued_share",
        document_id=manifest.document_id,
        event="issued",
        actor_org="Acme Pharma",
        actor_key_id="key_acme_primary",
        timestamp="2026-06-20T18:30:00Z",
        previous_event_hash=None,
        manifest_hash=manifest_hash_for(manifest),
        payload={"file_name": "agreement.pdf"},
        signature="",
    )
    response = client.post(
        "/documents",
        json={
            "signed_manifest": signed_manifest_payload(manifest, private_key),
            "initial_history": [signed_event_payload(event, private_key)],
        },
    )
    assert response.status_code == 200
    return manifest.document_id, content


def test_signed_document_secure_link_download_analytics_and_verification(client):
    document_id, content = _register_original(client)

    upload = client.put(
        f"/documents/{document_id}/content",
        content=content,
        headers={"X-File-Name": "agreement.pdf", "Content-Type": "application/pdf"},
    )
    assert upload.status_code == 204

    create_link = client.post(
        f"/documents/{document_id}/share-links",
        json={"access_method": "link", "expires_in_hours": 24},
    )
    assert create_link.status_code == 200
    token = create_link.json()["token"]
    assert token not in create_link.json()["link_id"]

    opened = client.get(f"/shares/{token}", headers={"X-Country": "DE"})
    assert opened.status_code == 200
    assert opened.json()["content_fingerprint"] == sha256_hex(content)

    downloaded = client.get(f"/shares/{token}/download", headers={"X-Country": "US"})
    assert downloaded.status_code == 200
    assert downloaded.content.startswith(content)
    assert downloaded.content.endswith(TRAILER_MAGIC)
    assert downloaded.content != content
    assert "agreement.pdf" in downloaded.headers["content-disposition"]

    analytics = client.get(f"/documents/{document_id}/share-analytics").json()
    assert analytics == {
        "document_id": document_id,
        "opens": 1,
        "downloads": 1,
        "download_rate_per_hour": 1.0,
        "countries": {"DE": 1, "US": 1},
    }

    verified = client.post("/verify/file", content=downloaded.content)
    assert verified.status_code == 200
    assert verified.json()["status"] == "valid"
    assert verified.json()["fingerprint_match"] is True
    assert verified.json()["manifest_signature_valid"] is True
    assert verified.json()["signature_chain_valid"] is True


def test_embedded_passport_detects_original_file_tampering(client):
    document_id, content = _register_original(client)
    client.put(
        f"/documents/{document_id}/content",
        content=content,
        headers={"X-File-Name": "agreement.pdf", "Content-Type": "application/pdf"},
    )
    token = client.post(
        f"/documents/{document_id}/share-links",
        json={"access_method": "link"},
    ).json()["token"]
    protected = bytearray(client.get(f"/shares/{token}/download").content)
    protected[0] ^= 1

    response = client.post("/verify/file", content=bytes(protected))

    assert response.status_code == 200
    assert response.json()["status"] == "tampered"
    assert response.json()["fingerprint_match"] is False


def test_embedded_passport_rejects_encrypted_metadata_tampering(client):
    document_id, content = _register_original(client)
    client.put(
        f"/documents/{document_id}/content",
        content=content,
        headers={"X-File-Name": "agreement.docx", "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    )
    token = client.post(f"/documents/{document_id}/share-links", json={"access_method": "link"}).json()["token"]
    protected = bytearray(client.get(f"/shares/{token}/download").content)
    protected[-len(TRAILER_MAGIC) - 9] ^= 1

    response = client.post("/verify/file", content=bytes(protected))

    assert response.status_code == 400
    assert "invalid or has been altered" in response.json()["detail"]


def test_content_upload_rejects_bytes_that_do_not_match_signed_hash(client):
    document_id, _ = _register_original(client)
    response = client.put(
        f"/documents/{document_id}/content",
        content=b"tampered bytes",
        headers={"X-File-Name": "agreement.pdf", "Content-Type": "application/pdf"},
    )
    assert response.status_code == 409
    assert "do not match" in response.json()["detail"]

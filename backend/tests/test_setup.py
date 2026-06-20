from __future__ import annotations

from app.models.dto import Tenant, TenantSetupRequest, PolicyTemplate, PublicKeyRecord

from .helpers import make_keypair


def test_setup_registers_tenant_policy_and_key(client):
    public_key_b64, _ = make_keypair()

    response = client.post(
        "/setup",
        json=TenantSetupRequest(
            tenant=Tenant(
                tenant_id="tenant_acme",
                org_name="Acme Pharma",
                domains=["acme.com"],
                admin_emails=["admin@acme.com"],
            ),
            policy_templates=[
                PolicyTemplate(
                    policy_id="no_external_ai",
                    name="No External AI",
                    policy={
                        "external_ai_upload": "blocked",
                        "secure_link_required": True,
                        "forwarding": "blocked",
                        "public_sharing": "blocked",
                    },
                )
            ],
            public_keys=[
                PublicKeyRecord(
                    key_id="key_acme_primary",
                    public_key_b64=public_key_b64,
                )
            ],
        ).model_dump(mode="json"),
    )

    assert response.status_code == 200
    assert response.json() == {
        "tenant_id": "tenant_acme",
        "status": "active",
        "registered_policy_templates": 1,
        "registered_public_keys": 1,
    }


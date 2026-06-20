from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.db import AuditLogORM, PolicyTemplateORM, PublicKeyORM, TenantORM
from app.models.dto import SetupResponse, TenantSetupRequest
from app.services.audit_service import log_action


def setup_tenant(session: Session, request: TenantSetupRequest) -> SetupResponse:
    tenant = session.get(TenantORM, request.tenant.tenant_id)
    if tenant is None:
        tenant = TenantORM(
            tenant_id=request.tenant.tenant_id,
            org_name=request.tenant.org_name,
            domains=request.tenant.domains,
            admin_emails=request.tenant.admin_emails,
            status=request.tenant.status,
        )
        session.add(tenant)
    else:
        tenant.org_name = request.tenant.org_name
        tenant.domains = request.tenant.domains
        tenant.admin_emails = request.tenant.admin_emails
        tenant.status = request.tenant.status

    for template in request.policy_templates:
        existing = session.query(PolicyTemplateORM).filter_by(
            tenant_id=request.tenant.tenant_id,
            policy_id=template.policy_id,
        ).one_or_none()
        if existing is None:
            session.add(
                PolicyTemplateORM(
                    tenant_id=request.tenant.tenant_id,
                    policy_id=template.policy_id,
                    name=template.name,
                    policy=template.policy,
                )
            )
        else:
            existing.name = template.name
            existing.policy = template.policy

    for key in request.public_keys:
        existing = session.get(PublicKeyORM, key.key_id)
        if existing is None:
            session.add(
                PublicKeyORM(
                    key_id=key.key_id,
                    tenant_id=request.tenant.tenant_id,
                    algorithm=key.algorithm,
                    public_key_b64=key.public_key_b64,
                    status=key.status,
                )
            )
        else:
            existing.tenant_id = request.tenant.tenant_id
            existing.algorithm = key.algorithm
            existing.public_key_b64 = key.public_key_b64
            existing.status = key.status
            if key.status == "revoked":
                existing.revoked_at = key.revoked_at
            else:
                existing.revoked_at = None

    log_action(
        session,
        action="setup",
        tenant_id=request.tenant.tenant_id,
        details={
            "policy_templates": len(request.policy_templates),
            "public_keys": len(request.public_keys),
        },
    )
    session.flush()
    return SetupResponse(
        tenant_id=request.tenant.tenant_id,
        status=tenant.status,
        registered_policy_templates=len(request.policy_templates),
        registered_public_keys=len(request.public_keys),
    )


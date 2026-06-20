from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.db import AuditLogORM


def log_action(
    session: Session,
    *,
    action: str,
    tenant_id: str | None = None,
    document_id: str | None = None,
    details: dict | None = None,
) -> None:
    session.add(
        AuditLogORM(
            action=action,
            tenant_id=tenant_id,
            document_id=document_id,
            details=details or {},
        )
    )


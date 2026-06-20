from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.db import DocumentORM, VerificationLogORM
from app.models.dto import PolicyDecision, VerifyRequest, VerifyResult
from app.security.canonical_json import canonical_json_bytes
from app.security.hashes import canonical_hash
from app.services.audit_service import log_action
from app.services.errors import NotFoundError
from app.services.signing_service import get_public_key, manifest_hash, verify_event_signature, verify_manifest_signature


@dataclass
class HistoryChainVerification:
    valid: bool
    reasons: list[str]
    signature_valid: bool = True
    revoked_key_used: bool = False


def _event_body(event: Any) -> dict[str, Any]:
    body = event.model_dump(mode="json")
    body.pop("signature", None)
    return body


def evaluate_policy(*, policy: dict, tags: list[str], usage_context: dict) -> PolicyDecision:
    operation = usage_context.get("operation", "unknown")
    if operation == "external_ai_upload":
        if "NO_EXTERNAL_AI" in tags:
            return PolicyDecision(operation=operation, allowed=False, reason="NO_EXTERNAL_AI")
        if policy.get("external_ai_upload") == "blocked":
            return PolicyDecision(operation=operation, allowed=False, reason="POLICY_EXTERNAL_AI_BLOCKED")
    if policy.get("secure_link_required") and operation == "direct_share":
        return PolicyDecision(operation=operation, allowed=False, reason="SECURE_LINK_REQUIRED")
    return PolicyDecision(operation=operation, allowed=True, reason=None)


def verify_history_chain(
    session: Session,
    *,
    history: list,
    expected_manifest_hash: str,
    expected_history_tip: str,
    document_id: str,
) -> HistoryChainVerification:
    if not history:
        return HistoryChainVerification(valid=False, reasons=["History chain missing"], signature_valid=False)

    previous_hash: str | None = None
    reasons: list[str] = []
    revoked_key_used = False
    signature_valid = True

    for event in history:
        body = _event_body(event)
        if body["document_id"] != document_id:
            return HistoryChainVerification(
                valid=False,
                reasons=["History event document_id mismatch"],
                signature_valid=False,
            )
        if body["manifest_hash"] != expected_manifest_hash:
            return HistoryChainVerification(
                valid=False,
                reasons=["History event manifest hash mismatch"],
            )
        if body["previous_event_hash"] != previous_hash:
            return HistoryChainVerification(
                valid=False,
                reasons=["History chain link mismatch"],
            )

        key = get_public_key(session, event.actor_key_id)
        if key is None:
            return HistoryChainVerification(
                valid=False,
                reasons=[f"Missing public key {event.actor_key_id}"],
                signature_valid=False,
            )
        if key.status == "revoked":
            revoked_key_used = True
            reasons.append(f"Revoked key used: {event.actor_key_id}")
        if not verify_event_signature(key.public_key_b64, event):
            signature_valid = False
            return HistoryChainVerification(
                valid=False,
                reasons=[f"Invalid signature for event {event.event_id}"],
                signature_valid=False,
                revoked_key_used=revoked_key_used,
            )
        previous_hash = canonical_hash(event.model_dump(mode="json"))

    if previous_hash != expected_history_tip:
        return HistoryChainVerification(
            valid=False,
            reasons=["History tip mismatch"],
            revoked_key_used=revoked_key_used,
            signature_valid=signature_valid,
        )

    return HistoryChainVerification(valid=True, reasons=reasons, revoked_key_used=revoked_key_used, signature_valid=signature_valid)


def verify_passport(session: Session, request: VerifyRequest) -> VerifyResult:
    stored_doc = session.get(DocumentORM, request.document_id)
    if stored_doc is None:
        return VerifyResult(
            status="unknown_document",
            document_id=request.document_id,
            fingerprint_match=False,
            manifest_signature_valid=False,
            signature_chain_valid=False,
            revoked=False,
            policy_decision=PolicyDecision(operation=request.usage_context.operation, allowed=False, reason="UNKNOWN_DOCUMENT"),
            reasons=["Document not found"],
        )

    manifest = request.signed_manifest.manifest
    issuer_key = get_public_key(session, manifest.issuer_key_id)
    if issuer_key is None:
        return _persist_verification(
            session,
            stored_doc,
            VerifyResult(
                status="invalid_signature",
                document_id=manifest.document_id,
                fingerprint_match=False,
                manifest_signature_valid=False,
                signature_chain_valid=False,
                revoked=False,
                policy_decision=PolicyDecision(operation=request.usage_context.operation, allowed=False, reason="ISSUER_KEY_NOT_FOUND"),
                reasons=[f"Issuer key {manifest.issuer_key_id} not found"],
            ),
            request.usage_context.model_dump(mode="json"),
        )
    if issuer_key.status == "revoked":
        result = VerifyResult(
            status="revoked",
            document_id=manifest.document_id,
            fingerprint_match=False,
            manifest_signature_valid=False,
            signature_chain_valid=False,
            revoked=True,
            policy_decision=PolicyDecision(operation=request.usage_context.operation, allowed=False, reason="ISSUER_KEY_REVOKED"),
            reasons=[f"Issuer key {manifest.issuer_key_id} is revoked"],
        )
        return _persist_verification(session, stored_doc, result, request.usage_context.model_dump(mode="json"))

    manifest_signature_valid = verify_manifest_signature(issuer_key.public_key_b64, request.signed_manifest)
    if not manifest_signature_valid:
        result = VerifyResult(
            status="invalid_signature",
            document_id=manifest.document_id,
            fingerprint_match=False,
            manifest_signature_valid=False,
            signature_chain_valid=False,
            revoked=False,
            policy_decision=PolicyDecision(operation=request.usage_context.operation, allowed=False, reason="MANIFEST_SIGNATURE_INVALID"),
            reasons=["Manifest signature invalid"],
        )
        return _persist_verification(session, stored_doc, result, request.usage_context.model_dump(mode="json"))

    computed_manifest_hash = manifest_hash(manifest)
    if computed_manifest_hash != stored_doc.manifest_hash:
        result = VerifyResult(
            status="tampered",
            document_id=manifest.document_id,
            fingerprint_match=False,
            manifest_signature_valid=True,
            signature_chain_valid=False,
            revoked=False,
            policy_decision=evaluate_policy(policy=manifest.policy, tags=manifest.embedded_ai_tags, usage_context=request.usage_context.model_dump(mode="json")),
            reasons=["Manifest hash does not match backend registry"],
        )
        return _persist_verification(session, stored_doc, result, request.usage_context.model_dump(mode="json"))

    fingerprint_match = request.computed_content_fingerprint == manifest.content_fingerprint
    chain_result = verify_history_chain(
        session,
        history=request.history,
        expected_manifest_hash=computed_manifest_hash,
        expected_history_tip=stored_doc.history_tip,
        document_id=manifest.document_id,
    )
    revoked = stored_doc.status == "revoked" or chain_result.revoked_key_used
    policy_decision = evaluate_policy(policy=manifest.policy, tags=manifest.embedded_ai_tags, usage_context=request.usage_context.model_dump(mode="json"))

    if revoked:
        status = "revoked"
    elif not fingerprint_match:
        status = "tampered"
    elif not chain_result.valid:
        status = "invalid_signature" if not chain_result.signature_valid else "tampered"
    else:
        status = "valid"

    reasons = ["Manifest signature valid"]
    reasons.extend(chain_result.reasons)
    if fingerprint_match:
        reasons.append("Content fingerprint matches")
    else:
        reasons.append("Content fingerprint mismatch")
    if policy_decision.allowed:
        reasons.append("Policy allows requested operation")
    else:
        reasons.append(f"{policy_decision.reason or 'Policy blocked requested operation'}")
    if revoked:
        reasons.append("Document or key revoked")
    elif chain_result.valid:
        reasons.append("Signing history chain valid")

    result = VerifyResult(
        status=status,
        document_id=manifest.document_id,
        fingerprint_match=fingerprint_match,
        manifest_signature_valid=True,
        signature_chain_valid=chain_result.valid,
        revoked=revoked,
        policy_decision=policy_decision,
        reasons=reasons,
    )
    return _persist_verification(session, stored_doc, result, request.usage_context.model_dump(mode="json"))


def _persist_verification(session: Session, document: DocumentORM, result: VerifyResult, usage_context: dict) -> VerifyResult:
    document.last_verified_status = result.status
    document.last_verified_at = datetime.now(timezone.utc)
    document.last_verification_reasons = result.reasons
    session.add(
        VerificationLogORM(
            document_id=document.document_id,
            status=result.status,
            fingerprint_match=result.fingerprint_match,
            manifest_signature_valid=result.manifest_signature_valid,
            signature_chain_valid=result.signature_chain_valid,
            revoked=result.revoked,
            reasons=result.reasons,
            usage_context=usage_context,
        )
    )
    log_action(
        session,
        action="verify",
        tenant_id=document.tenant_id,
        document_id=document.document_id,
        details={"status": result.status, "reasons": result.reasons},
    )
    session.commit()
    return result

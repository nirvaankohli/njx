# DocShield FastAPI Agent Build Guide

## Objective

Build the **DocShield blind backend API** using **FastAPI**.

This backend must support:

1. tenant setup
2. public-key registration
3. signed document manifest registration
4. append-only signing history
5. document verification
6. secure-link telemetry
7. dashboard + audit export

The backend must **never receive raw PDFs**.

The customer-hosted app / local SDK handles all PDF operations:

- PDF upload
- local fingerprint computation
- passport creation
- manifest signing
- PDF metadata embedding
- passport extraction
- local verification fingerprint recomputation

The DocShield API only stores and verifies **non-content metadata**.

---

# 1. Core Rule: Blind Backend

## Never accept these in the FastAPI backend

Do not create endpoints that accept:

- raw PDF files
- `UploadFile` for protected documents
- extracted PDF text
- OCR output
- document previews
- page images
- raw document body

## Allowed backend inputs

The API may receive:

- `tenant_id`
- `document_id`
- `content_fingerprint`
- signed manifest
- embedded AI tags
- policy fields
- public keys
- signature history events
- revocation state
- secure-link telemetry
- hashed IP / user-agent
- country
- action type
- anomaly/risk data

Simple product wording:

> DocShield knows about the document. DocShield does not receive the document.

---

# 2. Minimal API Surface

Keep the API small.

## Endpoint groups

| Group | Endpoint | Purpose |
|---|---|---|
| Setup | `POST /setup` | Register tenant, policy templates, public keys |
| Register document | `POST /documents` | Store signed manifest metadata |
| Add history event | `POST /documents/{document_id}/events` | Append signed lifecycle event |
| Verify | `POST /verify` | Verify manifest, signatures, hash, revocation, AI policy |
| Telemetry | `POST /access-events` | Store secure-link access events |
| Dashboard | `GET /dashboard` | Return summary, activity, risk signals |
| Audit | `GET /audit-export` | Export manifest, history, verification, telemetry |

Do not split these into many micro-endpoints unless the implementation truly needs it.

---

# 3. Recommended FastAPI Project Structure

```txt
docshield-api/
  app/
    main.py

    api/
      routes_setup.py
      routes_documents.py
      routes_verify.py
      routes_telemetry.py
      routes_dashboard.py

    models/
      dto.py
      db.py

    services/
      setup_service.py
      document_service.py
      verification_service.py
      telemetry_service.py
      risk_service.py
      audit_service.py

    security/
      canonical_json.py
      signatures.py
      hashes.py

    db/
      session.py
      migrations/

    tests/
      test_setup.py
      test_documents.py
      test_events.py
      test_verify.py
      test_telemetry.py
```

---

# 4. Dependencies

Use these MVP dependencies:

```txt
fastapi
uvicorn[standard]
pydantic
sqlalchemy
alembic
asyncpg
cryptography
python-dotenv
```

Optional but recommended:

```txt
jcs
```

Use `jcs` for RFC 8785-style JSON canonicalization if available. If not, implement a stable deterministic JSON serializer and keep it consistent across signing and verification.

---

# 5. Data Model

## 5.1 Tenant

```python
class Tenant(BaseModel):
    tenant_id: str
    org_name: str
    domains: list[str] = []
    admin_emails: list[str] = []
    status: Literal["active", "disabled"] = "active"
```

## 5.2 Policy Template

```python
class PolicyTemplate(BaseModel):
    policy_id: str
    tenant_id: str
    name: str
    policy: dict
```

Example policy:

```json
{
  "external_ai_upload": "blocked",
  "secure_link_required": true,
  "forwarding": "blocked",
  "public_sharing": "blocked"
}
```

## 5.3 Public Key

Private keys stay local to the customer.

```python
class PublicKeyRecord(BaseModel):
    key_id: str
    tenant_id: str
    algorithm: Literal["Ed25519"] = "Ed25519"
    public_key_b64: str
    status: Literal["active", "revoked"] = "active"
    created_at: datetime
    revoked_at: datetime | None = None
```

## 5.4 Manifest Claims

This is the object signed by the customer-local SDK.

Do **not** include the signature inside the object being signed.

```python
class ManifestClaims(BaseModel):
    schema_version: str = "1.0"
    tenant_id: str
    document_id: str
    issuer_key_id: str
    content_fingerprint: str
    policy: dict
    embedded_ai_tags: list[str]
    created_at: datetime
```

## 5.5 Signed Manifest

This is what gets stored by the backend.

```python
class SignedManifest(BaseModel):
    manifest: ManifestClaims
    manifest_signature: str
    signature_algorithm: Literal["Ed25519"] = "Ed25519"
```

Signature format:

```txt
ed25519:<base64-signature>
```

## 5.6 Signing History Event

Each event is append-only.

```python
class SignatureHistoryEvent(BaseModel):
    event_id: str
    document_id: str
    event: Literal[
        "issued",
        "sent",
        "received",
        "confirmed_received",
        "approved",
        "reissued",
        "revoked"
    ]
    actor_org: str
    actor_key_id: str
    timestamp: datetime
    previous_event_hash: str | None = None
    manifest_hash: str
    payload: dict = {}
    signature: str
```

The signature signs the event object **without** the `signature` field.

## 5.7 Access Event

```python
class AccessEvent(BaseModel):
    event_id: str
    tenant_id: str
    document_id: str
    link_id: str | None = None
    timestamp: datetime
    action: Literal["open", "download", "token_failed", "verify_attempt", "ai_upload_blocked"]
    ip_hash: str | None = None
    user_agent_hash: str | None = None
    country: str | None = None
    result: Literal["allowed", "blocked", "failed"] = "allowed"
    reason: str | None = None
```

---

# 6. Signing Strategy

Use **Ed25519**.

The backend verifies signatures using customer-registered public keys.

The backend never receives private keys.

## 6.1 Canonical JSON

All signed objects must be serialized with canonical JSON before signing or verifying.

Create:

```python
# app/security/canonical_json.py

import json

def canonical_json_bytes(obj: dict) -> bytes:
    return json.dumps(
        obj,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=str
    ).encode("utf-8")
```

If using `jcs`, replace this with:

```python
import jcs

def canonical_json_bytes(obj: dict) -> bytes:
    return jcs.canonicalize(obj)
```

Important:

- signing and verification must use the same canonicalization
- remove signature fields before canonicalization
- do not include mutable backend fields in signed payloads

## 6.2 Hash Function

```python
# app/security/hashes.py

import hashlib
from app.security.canonical_json import canonical_json_bytes

def sha256_hex(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()

def canonical_hash(obj: dict) -> str:
    return sha256_hex(canonical_json_bytes(obj))
```

## 6.3 Signature Verification

```python
# app/security/signatures.py

import base64
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

def parse_ed25519_signature(signature: str) -> bytes:
    if not signature.startswith("ed25519:"):
        raise ValueError("Unsupported signature format")
    return base64.b64decode(signature.split(":", 1)[1])

def verify_ed25519(public_key_b64: str, signed_bytes: bytes, signature: str) -> bool:
    try:
        public_key = Ed25519PublicKey.from_public_bytes(base64.b64decode(public_key_b64))
        public_key.verify(parse_ed25519_signature(signature), signed_bytes)
        return True
    except Exception:
        return False
```

---

# 7. What Gets Signed

## 7.1 Root Manifest Signature

The customer-local SDK signs `ManifestClaims`.

```json
{
  "schema_version": "1.0",
  "tenant_id": "tenant_acme",
  "document_id": "doc_7f92ab31",
  "issuer_key_id": "key_supplierco_primary",
  "content_fingerprint": "sha256:<customer-local-fingerprint>",
  "policy": {
    "external_ai_upload": "blocked",
    "secure_link_required": true,
    "forwarding": "blocked",
    "public_sharing": "blocked"
  },
  "embedded_ai_tags": [
    "NO_EXTERNAL_AI",
    "SECURE_LINK_ONLY"
  ],
  "created_at": "2026-06-20T18:30:00Z"
}
```

Backend verification:

1. fetch `issuer_key_id`
2. canonicalize manifest claims
3. verify `manifest_signature`
4. compute `manifest_hash`
5. store manifest metadata and hash

## 7.2 History Event Signature

Each event signs the event body without its `signature`.

Event body to sign:

```json
{
  "event_id": "evt_001",
  "document_id": "doc_7f92ab31",
  "event": "issued",
  "actor_org": "SupplierCo",
  "actor_key_id": "key_supplierco_primary",
  "timestamp": "2026-06-20T18:30:00Z",
  "previous_event_hash": null,
  "manifest_hash": "sha256:<canonical-manifest-hash>",
  "payload": {}
}
```

Signed event:

```json
{
  "event_id": "evt_001",
  "document_id": "doc_7f92ab31",
  "event": "issued",
  "actor_org": "SupplierCo",
  "actor_key_id": "key_supplierco_primary",
  "timestamp": "2026-06-20T18:30:00Z",
  "previous_event_hash": null,
  "manifest_hash": "sha256:<canonical-manifest-hash>",
  "payload": {},
  "signature": "ed25519:<base64-signature>"
}
```

Event hash:

```txt
sha256(canonical_json(signed_event))
```

Next event must set:

```txt
previous_event_hash = event_hash_of_prior_signed_event
```

This creates the append-only signing chain.

---

# 8. Endpoint Specs

## 8.1 `POST /setup`

Registers tenant, policy templates, and public keys.

This endpoint can be idempotent. If tenant exists, update allowed policy templates and keys.

### Request

```json
{
  "tenant": {
    "tenant_id": "tenant_acme",
    "org_name": "Acme Pharma",
    "domains": ["acme.com"],
    "admin_emails": ["admin@acme.com"]
  },
  "policy_templates": [
    {
      "policy_id": "no_external_ai",
      "name": "No External AI",
      "policy": {
        "external_ai_upload": "blocked",
        "secure_link_required": true,
        "forwarding": "blocked",
        "public_sharing": "blocked"
      }
    }
  ],
  "public_keys": [
    {
      "key_id": "key_acme_primary",
      "algorithm": "Ed25519",
      "public_key_b64": "<base64-public-key>"
    }
  ]
}
```

### Response

```json
{
  "tenant_id": "tenant_acme",
  "status": "active",
  "registered_policy_templates": 1,
  "registered_public_keys": 1
}
```

### Behavior

- validate tenant shape
- store tenant
- upsert policy templates
- upsert public keys
- reject private keys if provided
- audit log setup action

---

## 8.2 `POST /documents`

Registers a signed manifest.

This endpoint does **not** receive the PDF.

### Request

```json
{
  "signed_manifest": {
    "manifest": {
      "schema_version": "1.0",
      "tenant_id": "tenant_acme",
      "document_id": "doc_7f92ab31",
      "issuer_key_id": "key_acme_primary",
      "content_fingerprint": "sha256:<customer-local-fingerprint>",
      "policy": {
        "external_ai_upload": "blocked",
        "secure_link_required": true,
        "forwarding": "blocked",
        "public_sharing": "blocked"
      },
      "embedded_ai_tags": ["NO_EXTERNAL_AI", "SECURE_LINK_ONLY"],
      "created_at": "2026-06-20T18:30:00Z"
    },
    "manifest_signature": "ed25519:<base64-signature>",
    "signature_algorithm": "Ed25519"
  },
  "initial_history": [
    {
      "event_id": "evt_issued_001",
      "document_id": "doc_7f92ab31",
      "event": "issued",
      "actor_org": "SupplierCo",
      "actor_key_id": "key_acme_primary",
      "timestamp": "2026-06-20T18:30:00Z",
      "previous_event_hash": null,
      "manifest_hash": "sha256:<canonical-manifest-hash>",
      "payload": {},
      "signature": "ed25519:<base64-signature>"
    }
  ]
}
```

### Response

```json
{
  "document_id": "doc_7f92ab31",
  "manifest_hash": "sha256:<canonical-manifest-hash>",
  "status": "registered",
  "history_tip": "sha256:<last-event-hash>"
}
```

### Behavior

- fetch tenant
- fetch issuer public key
- canonicalize manifest
- verify manifest signature
- compute manifest hash
- validate every initial history event
- verify event signatures
- validate `previous_event_hash` chain
- store document record
- store events
- return current history tip

---

## 8.3 `POST /documents/{document_id}/events`

Appends a signed lifecycle event.

Use this for:

- sent
- received
- confirmed received
- approved
- reissued
- revoked

Revocation can be represented as a signed event instead of a separate endpoint.

### Request

```json
{
  "event_id": "evt_confirmed_002",
  "document_id": "doc_7f92ab31",
  "event": "confirmed_received",
  "actor_org": "BuyerCo",
  "actor_key_id": "key_buyerco_primary",
  "timestamp": "2026-06-20T19:10:00Z",
  "previous_event_hash": "sha256:<prior-event-hash>",
  "manifest_hash": "sha256:<canonical-manifest-hash>",
  "payload": {
    "note": "Buyer confirmed receipt"
  },
  "signature": "ed25519:<base64-signature>"
}
```

### Response

```json
{
  "document_id": "doc_7f92ab31",
  "event_id": "evt_confirmed_002",
  "accepted": true,
  "history_tip": "sha256:<new-event-hash>"
}
```

### Behavior

- document must exist
- actor public key must exist and be active
- event manifest hash must match stored document manifest hash
- event `previous_event_hash` must match current stored history tip
- signature must verify
- append event
- if event is `revoked`, mark document revoked
- audit log append action

---

## 8.4 `POST /verify`

Verifies the passport extracted by the local verifier or AI gateway.

This endpoint does **not** receive the PDF.

The verifier does local work first:

1. read passport from PDF
2. recompute local content fingerprint
3. call `/verify` with extracted metadata and hash

### Request

```json
{
  "document_id": "doc_7f92ab31",
  "signed_manifest": {
    "manifest": {
      "schema_version": "1.0",
      "tenant_id": "tenant_acme",
      "document_id": "doc_7f92ab31",
      "issuer_key_id": "key_acme_primary",
      "content_fingerprint": "sha256:<customer-local-fingerprint>",
      "policy": {
        "external_ai_upload": "blocked",
        "secure_link_required": true,
        "forwarding": "blocked",
        "public_sharing": "blocked"
      },
      "embedded_ai_tags": ["NO_EXTERNAL_AI", "SECURE_LINK_ONLY"],
      "created_at": "2026-06-20T18:30:00Z"
    },
    "manifest_signature": "ed25519:<base64-signature>",
    "signature_algorithm": "Ed25519"
  },
  "history": [
    {
      "event_id": "evt_issued_001",
      "document_id": "doc_7f92ab31",
      "event": "issued",
      "actor_org": "SupplierCo",
      "actor_key_id": "key_acme_primary",
      "timestamp": "2026-06-20T18:30:00Z",
      "previous_event_hash": null,
      "manifest_hash": "sha256:<canonical-manifest-hash>",
      "payload": {},
      "signature": "ed25519:<base64-signature>"
    }
  ],
  "computed_content_fingerprint": "sha256:<verifier-local-fingerprint>",
  "usage_context": {
    "operation": "external_ai_upload",
    "app": "reference_ai_gateway"
  }
}
```

### Response

```json
{
  "status": "valid",
  "document_id": "doc_7f92ab31",
  "fingerprint_match": true,
  "manifest_signature_valid": true,
  "signature_chain_valid": true,
  "revoked": false,
  "policy_decision": {
    "operation": "external_ai_upload",
    "allowed": false,
    "reason": "NO_EXTERNAL_AI"
  },
  "reasons": [
    "Manifest signature valid",
    "Signing history chain valid",
    "Content fingerprint matches",
    "External AI upload blocked by policy"
  ]
}
```

### Possible statuses

```txt
valid
tampered
revoked
metadata_stripped
unverifiable_rebuilt_copy
unknown_document
invalid_signature
```

### Behavior

- verify manifest signature
- compute manifest hash
- compare against stored manifest hash
- verify all history events
- compare computed fingerprint against manifest fingerprint
- check key revocation
- check document revocation
- evaluate policy for requested operation
- optionally log verification decision
- return machine-readable and human-readable result

### AI policy logic

For `usage_context.operation = "external_ai_upload"`:

```python
if "NO_EXTERNAL_AI" in embedded_ai_tags:
    allowed = False
```

or:

```python
if policy.external_ai_upload == "blocked":
    allowed = False
```

The response should clearly explain the block reason.

---

## 8.5 `POST /access-events`

Stores secure-link telemetry.

The secure-share gateway can be customer-hosted or DocShield-managed per tenant. Either way, the backend should receive only telemetry, not document content.

### Request

```json
{
  "event_id": "acc_001",
  "tenant_id": "tenant_acme",
  "document_id": "doc_7f92ab31",
  "link_id": "link_buyerco_001",
  "timestamp": "2026-06-20T20:00:00Z",
  "action": "download",
  "ip_hash": "sha256:<hash>",
  "user_agent_hash": "sha256:<hash>",
  "country": "US",
  "result": "allowed",
  "reason": null
}
```

### Response

```json
{
  "accepted": true,
  "event_id": "acc_001",
  "risk_recomputed": true
}
```

### Behavior

- validate document exists
- store access event
- recompute simple risk signals
- do not store raw IP unless explicitly configured for a dedicated tenant
- do not store document content
- audit telemetry ingestion

---

## 8.6 `GET /dashboard`

Returns summary data for Tier 2.

### Query params

```txt
tenant_id
document_id optional
from optional
to optional
```

### Response

```json
{
  "tenant_id": "tenant_acme",
  "documents": 25,
  "access_events": 140,
  "alerts": [
    {
      "document_id": "doc_7f92ab31",
      "severity": "high",
      "reason_codes": ["download_spike", "new_geography"],
      "score": 87
    }
  ],
  "recent_activity": [
    {
      "document_id": "doc_7f92ab31",
      "timestamp": "2026-06-20T20:00:00Z",
      "action": "download",
      "country": "US"
    }
  ]
}
```

### Behavior

- return counts
- return access timeline
- return signing history summary
- return risk score and reasons
- never include content

---

## 8.7 `GET /audit-export`

Exports a full non-content audit package.

### Query params

```txt
tenant_id
document_id
```

### Response

```json
{
  "tenant_id": "tenant_acme",
  "document_id": "doc_7f92ab31",
  "manifest": {},
  "manifest_hash": "sha256:<hash>",
  "history": [],
  "revocation": {
    "document_revoked": false,
    "revoked_keys": []
  },
  "access_events": [],
  "risk_signals": [],
  "verification_summary": {
    "last_status": "valid",
    "last_verified_at": "2026-06-20T20:15:00Z"
  }
}
```

---

# 9. Verification Algorithm

Implement this in `app/services/verification_service.py`.

```python
def verify_passport(request: VerifyRequest) -> VerifyResult:
    # 1. Load stored document record.
    stored_doc = documents_repo.get(request.document_id)
    if not stored_doc:
        return unknown_document()

    # 2. Verify manifest signature.
    manifest = request.signed_manifest.manifest
    issuer_key = key_repo.get(manifest.issuer_key_id)

    if not issuer_key or issuer_key.status != "active":
        return revoked_or_invalid_key()

    manifest_bytes = canonical_json_bytes(manifest.model_dump(mode="json"))
    manifest_signature_valid = verify_ed25519(
        issuer_key.public_key_b64,
        manifest_bytes,
        request.signed_manifest.manifest_signature
    )

    if not manifest_signature_valid:
        return invalid_signature()

    # 3. Check manifest hash matches stored record.
    manifest_hash = canonical_hash(manifest.model_dump(mode="json"))
    if manifest_hash != stored_doc.manifest_hash:
        return tampered("Manifest hash does not match backend registry")

    # 4. Check content fingerprint.
    fingerprint_match = (
        request.computed_content_fingerprint == manifest.content_fingerprint
    )

    # 5. Verify append-only event chain.
    chain_result = verify_history_chain(
        history=request.history,
        expected_manifest_hash=manifest_hash,
        expected_history_tip=stored_doc.history_tip
    )

    # 6. Check revocation.
    revoked = stored_doc.status == "revoked" or key_repo.any_revoked_key_used(request.history)

    # 7. Evaluate AI policy.
    policy_decision = evaluate_policy(
        policy=manifest.policy,
        tags=manifest.embedded_ai_tags,
        usage_context=request.usage_context
    )

    # 8. Build final status.
    if revoked:
        status = "revoked"
    elif not fingerprint_match:
        status = "tampered"
    elif not chain_result.valid:
        status = "tampered"
    else:
        status = "valid"

    return VerifyResult(
        status=status,
        document_id=manifest.document_id,
        fingerprint_match=fingerprint_match,
        manifest_signature_valid=manifest_signature_valid,
        signature_chain_valid=chain_result.valid,
        revoked=revoked,
        policy_decision=policy_decision,
        reasons=[...]
    )
```

---

# 10. History Chain Verification

```python
def signed_event_body(event: dict) -> dict:
    body = dict(event)
    body.pop("signature", None)
    return body

def verify_history_chain(history: list[dict], expected_manifest_hash: str, expected_history_tip: str):
    previous_hash = None

    for event in history:
        if event["manifest_hash"] != expected_manifest_hash:
            return invalid("Event manifest hash mismatch")

        if event["previous_event_hash"] != previous_hash:
            return invalid("Broken previous_event_hash chain")

        actor_key = key_repo.get(event["actor_key_id"])
        if not actor_key or actor_key.status != "active":
            return invalid("Actor key missing or revoked")

        body_bytes = canonical_json_bytes(signed_event_body(event))
        if not verify_ed25519(actor_key.public_key_b64, body_bytes, event["signature"]):
            return invalid("Invalid event signature")

        previous_hash = canonical_hash(event)

    if previous_hash != expected_history_tip:
        return invalid("History tip mismatch")

    return valid()
```

Important:

- first event uses `previous_event_hash = null`
- every later event points to the hash of the previous signed event
- every event includes `manifest_hash`
- every event is signed by `actor_key_id`

---

# 11. Risk Scoring Rules

Keep anomaly detection transparent and rules-based.

Do not call it heavy ML in the MVP.

## Rule examples

```python
def score_access_events(events):
    score = 0
    reasons = []

    if downloads_in_window(events, minutes=15) > 10:
        score += 30
        reasons.append("download_spike")

    if has_new_country(events):
        score += 20
        reasons.append("new_geography")

    if multiple_ip_user_agent_clusters(events):
        score += 20
        reasons.append("multiple_viewer_clusters")

    if repeated_token_failures(events):
        score += 25
        reasons.append("repeated_failed_token_checks")

    if revoked_access_attempt(events):
        score += 50
        reasons.append("revoked_document_access")

    return {
        "score": min(score, 100),
        "reason_codes": reasons,
        "severity": severity_from_score(score)
    }
```

Severity:

```txt
0-29   low
30-69  medium
70-100 high
```

---

# 12. Database Tables

Use these tables for MVP.

## tenants

```txt
tenant_id primary key
org_name
domains jsonb
admin_emails jsonb
status
created_at
updated_at
```

## policy_templates

```txt
policy_id primary key
tenant_id foreign key
name
policy jsonb
created_at
updated_at
```

## public_keys

```txt
key_id primary key
tenant_id foreign key
algorithm
public_key_b64
status
created_at
revoked_at
```

## documents

```txt
document_id primary key
tenant_id foreign key
issuer_key_id
manifest jsonb
manifest_signature
manifest_hash
content_fingerprint
policy jsonb
embedded_ai_tags jsonb
history_tip
status
created_at
revoked_at
```

## signature_events

```txt
event_id primary key
document_id foreign key
event
actor_org
actor_key_id
timestamp
previous_event_hash
manifest_hash
payload jsonb
signature
event_hash
created_at
```

## access_events

```txt
event_id primary key
tenant_id
document_id
link_id
timestamp
action
ip_hash
user_agent_hash
country
result
reason
created_at
```

## risk_signals

```txt
id primary key
tenant_id
document_id
score
severity
reason_codes jsonb
generated_at
```

## audit_log

```txt
id primary key
tenant_id
actor
action
target_type
target_id
timestamp
metadata jsonb
```

---

# 13. FastAPI Router Skeleton

```python
# app/main.py

from fastapi import FastAPI
from app.api.routes_setup import router as setup_router
from app.api.routes_documents import router as documents_router
from app.api.routes_verify import router as verify_router
from app.api.routes_telemetry import router as telemetry_router
from app.api.routes_dashboard import router as dashboard_router

app = FastAPI(title="DocShield Blind Backend API", version="0.1.0")

app.include_router(setup_router, tags=["setup"])
app.include_router(documents_router, tags=["documents"])
app.include_router(verify_router, tags=["verify"])
app.include_router(telemetry_router, tags=["telemetry"])
app.include_router(dashboard_router, tags=["dashboard"])
```

```python
# app/api/routes_documents.py

from fastapi import APIRouter, HTTPException
from app.models.dto import RegisterDocumentRequest, AppendEventRequest
from app.services.document_service import register_document, append_event

router = APIRouter()

@router.post("/documents")
async def post_document(req: RegisterDocumentRequest):
    result = await register_document(req)
    if not result.accepted:
        raise HTTPException(status_code=400, detail=result.reason)
    return result

@router.post("/documents/{document_id}/events")
async def post_document_event(document_id: str, req: AppendEventRequest):
    if document_id != req.document_id:
        raise HTTPException(status_code=400, detail="document_id path/body mismatch")

    result = await append_event(req)
    if not result.accepted:
        raise HTTPException(status_code=400, detail=result.reason)
    return result
```

```python
# app/api/routes_verify.py

from fastapi import APIRouter
from app.models.dto import VerifyRequest
from app.services.verification_service import verify_passport

router = APIRouter()

@router.post("/verify")
async def post_verify(req: VerifyRequest):
    return await verify_passport(req)
```

---

# 14. Pydantic DTO Skeleton

```python
# app/models/dto.py

from datetime import datetime
from typing import Literal, Optional, Any
from pydantic import BaseModel, Field

class ManifestClaims(BaseModel):
    schema_version: str = "1.0"
    tenant_id: str
    document_id: str
    issuer_key_id: str
    content_fingerprint: str
    policy: dict[str, Any]
    embedded_ai_tags: list[str]
    created_at: datetime

class SignedManifest(BaseModel):
    manifest: ManifestClaims
    manifest_signature: str
    signature_algorithm: Literal["Ed25519"] = "Ed25519"

class SignatureHistoryEvent(BaseModel):
    event_id: str
    document_id: str
    event: Literal[
        "issued",
        "sent",
        "received",
        "confirmed_received",
        "approved",
        "reissued",
        "revoked"
    ]
    actor_org: str
    actor_key_id: str
    timestamp: datetime
    previous_event_hash: Optional[str] = None
    manifest_hash: str
    payload: dict[str, Any] = Field(default_factory=dict)
    signature: str

class RegisterDocumentRequest(BaseModel):
    signed_manifest: SignedManifest
    initial_history: list[SignatureHistoryEvent] = Field(default_factory=list)

class AppendEventRequest(SignatureHistoryEvent):
    pass

class UsageContext(BaseModel):
    operation: Optional[str] = None
    app: Optional[str] = None

class VerifyRequest(BaseModel):
    document_id: str
    signed_manifest: SignedManifest
    history: list[SignatureHistoryEvent]
    computed_content_fingerprint: str
    usage_context: UsageContext | None = None

class PolicyDecision(BaseModel):
    operation: str | None
    allowed: bool
    reason: str | None = None

class VerifyResult(BaseModel):
    status: Literal[
        "valid",
        "tampered",
        "revoked",
        "metadata_stripped",
        "unverifiable_rebuilt_copy",
        "unknown_document",
        "invalid_signature"
    ]
    document_id: str | None = None
    fingerprint_match: bool
    manifest_signature_valid: bool
    signature_chain_valid: bool
    revoked: bool
    policy_decision: PolicyDecision | None = None
    reasons: list[str]
```

---

# 15. Local SDK Boundary

The FastAPI backend must assume these are done outside the backend:

```txt
protect_pdf(input_pdf):
  compute content fingerprint locally
  build manifest claims
  sign manifest using local private key
  create initial signed history event
  embed passport into PDF metadata / attachment / names tree
  call POST /documents with signed manifest only
```

```txt
verify_pdf(input_pdf):
  extract passport locally
  recompute content fingerprint locally
  call POST /verify with signed manifest + hash only
  show returned status
```

The backend should not know how to parse PDF files.

The local SDK / Electron app owns:

- XMP metadata embedding
- embedded `docshield-manifest.json`
- custom names tree entry
- incremental update marker
- fragile forensic markers
- PDF compatibility handling

---

# 16. Secure-Link Handling

For MVP, do not add a separate `POST /secure-links` endpoint unless needed.

The customer secure-share gateway can create links locally and emit:

```txt
POST /access-events
```

Use `link_id` as an opaque identifier.

If the product later requires backend-managed link issuance, add:

```txt
POST /secure-links
```

But keep it out of the minimal MVP API unless explicitly needed.

Secure-link mode should support:

- per-recipient link IDs
- token validation
- expiration
- revoked document checks
- open/download events
- hashed IP and user-agent logging
- country derivation
- repeated failure counting
- risk scoring

---

# 17. Policy Evaluation

Implement simple policy checks.

```python
def evaluate_policy(policy: dict, tags: list[str], usage_context):
    operation = usage_context.operation if usage_context else None

    if operation == "external_ai_upload":
        if policy.get("external_ai_upload") == "blocked":
            return {
                "operation": operation,
                "allowed": False,
                "reason": "external_ai_upload blocked by manifest policy"
            }

        if "NO_EXTERNAL_AI" in tags:
            return {
                "operation": operation,
                "allowed": False,
                "reason": "NO_EXTERNAL_AI"
            }

    return {
        "operation": operation,
        "allowed": True,
        "reason": None
    }
```

---

# 18. Authentication

For MVP, require API authentication on all endpoints.

Accept one of:

- OAuth2 client credentials
- signed service requests
- tenant API key for pilot only

Do not make public write endpoints.

Minimum MVP rule:

```txt
Every request must include tenant identity and API credential.
Every write operation must be audit logged.
```

---

# 19. Error Handling

Use clear error codes.

```txt
TENANT_NOT_FOUND
KEY_NOT_FOUND
KEY_REVOKED
DOCUMENT_NOT_FOUND
DOCUMENT_REVOKED
INVALID_MANIFEST_SIGNATURE
INVALID_EVENT_SIGNATURE
BROKEN_HISTORY_CHAIN
MANIFEST_HASH_MISMATCH
FINGERPRINT_MISMATCH
POLICY_BLOCKED_EXTERNAL_AI
```

Example error:

```json
{
  "error": "BROKEN_HISTORY_CHAIN",
  "message": "Event previous_event_hash does not match current history tip"
}
```

---

# 20. Tests The Agent Must Build

## Setup tests

- tenant can be created
- public key can be registered
- private key is rejected
- policy template can be registered

## Document tests

- valid signed manifest is accepted
- invalid manifest signature is rejected
- missing issuer key is rejected
- duplicate document ID is rejected or idempotently handled

## Event tests

- valid next event is accepted
- broken `previous_event_hash` is rejected
- invalid event signature is rejected
- event with wrong manifest hash is rejected
- revocation event marks document revoked

## Verify tests

- valid passport returns `valid`
- changed fingerprint returns `tampered`
- revoked document returns `revoked`
- revoked key returns `revoked`
- broken event chain returns `tampered`
- `NO_EXTERNAL_AI` returns policy decision `allowed=false`

## Telemetry tests

- access event accepted
- download spike creates risk signal
- new geography creates risk signal
- repeated token failures creates risk signal

---

# 21. Implementation Order

Build in this order:

1. Pydantic DTOs
2. canonical JSON helper
3. Ed25519 public-key verification
4. DB tables
5. `POST /setup`
6. `POST /documents`
7. `POST /documents/{document_id}/events`
8. `POST /verify`
9. `POST /access-events`
10. dashboard/risk scoring
11. audit export
12. auth and audit logging hardening

---

# 22. Non-Negotiable Product Language

Do not say:

- unremovable watermark
- guaranteed hidden tracking
- universal offline tracking
- dark web removal
- automatic PII detection

Do say:

- hidden signed passport
- tamper-evident provenance
- layered PDF passport
- blind backend
- controlled-share telemetry
- secure-link anomaly detection
- AI policy tags

---

# 23. Agent Acceptance Criteria

The implementation is correct when:

- there is no endpoint that accepts raw PDFs
- `POST /documents` accepts only signed manifest metadata
- `POST /verify` accepts only extracted passport metadata and a locally computed fingerprint
- backend verifies Ed25519 signatures
- event history is append-only with `previous_event_hash`
- revocation is enforced by `/verify`
- `NO_EXTERNAL_AI` blocks external AI upload in the verification response
- telemetry can drive dashboard risk signals
- audit export contains manifest, history, revocation, telemetry, and risk state
- all major write actions are audit logged

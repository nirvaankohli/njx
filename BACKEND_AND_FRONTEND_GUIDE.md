# DocShield Backend Endpoints and Frontend Build Guide

This guide is based on the current backend code in `backend/app`.
It covers:

- every app endpoint currently exposed by FastAPI
- how to call each endpoint
- the recommended frontend pages and data flow to build a website on top of this API

## Base URL

For local development, assume the API is running at:

```text
http://127.0.0.1:8000
```

The backend uses a local SQLite database by default:

```text
DOCSHIELD_DATABASE_URL=sqlite:///./docshield.db
```

You can override that with a different database URL in the environment.

## What The Backend Does

The API supports six main app workflows:

1. Tenant setup
2. Document registration
3. Appending signed history events
4. Verification
5. Access telemetry
6. Dashboard and audit export

The backend currently does not show any auth middleware or CORS middleware in code, so if the frontend runs on a different origin you will likely want to add CORS before shipping beyond local development.

## Endpoint Reference

### 1. `POST /setup`

Registers or updates a tenant, policy templates, and public keys.

#### Request body

```json
{
  "tenant": {
    "tenant_id": "tenant_acme",
    "org_name": "Acme Pharma",
    "domains": ["acme.com"],
    "admin_emails": ["admin@acme.com"],
    "status": "active"
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
      "public_key_b64": "base64-public-key",
      "status": "active"
    }
  ]
}
```

#### Response

```json
{
  "tenant_id": "tenant_acme",
  "status": "active",
  "registered_policy_templates": 1,
  "registered_public_keys": 1
}
```

#### Notes

- If the tenant already exists, the endpoint updates it.
- Policy templates are matched by `tenant_id + policy_id`.
- Public keys are matched by `key_id`.
- `PublicKeyRecord.revoked_at` is only relevant when a key is marked revoked.

#### Common errors

- `409 Conflict` if the request violates business rules in the service layer.
- `400 Bad Request` for malformed payloads.

#### Frontend use

This is the first setup screen in the app. A frontend usually needs:

- tenant identity fields
- admin email fields
- policy template editor
- public-key paste/upload form

---

### 2. `POST /documents`

Registers a signed document manifest and its initial signed history.

#### Request body

```json
{
  "signed_manifest": {
    "manifest": {
      "schema_version": "1.0",
      "tenant_id": "tenant_acme",
      "document_id": "doc_7f92ab31",
      "issuer_key_id": "key_acme_primary",
      "content_fingerprint": "sha256:1234",
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
    },
    "manifest_signature": "ed25519:...",
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
      "manifest_hash": "sha256:...",
      "payload": {},
      "signature": "ed25519:..."
    }
  ]
}
```

#### Response

```json
{
  "document_id": "doc_7f92ab31",
  "manifest_hash": "sha256:...",
  "status": "registered",
  "history_tip": "sha256:..."
}
```

#### Notes

- The tenant in the manifest must already exist.
- The issuer key must exist and be active.
- The manifest signature is verified before registration.
- `initial_history` must contain at least one signed event.
- The backend stores the manifest, hash, signature, content fingerprint, policy, tags, and signing history tip.

#### Common errors

- `404 Not Found` if the tenant or issuer key does not exist.
- `409 Conflict` if the document already exists or the manifest/history data does not validate.

#### Frontend use

This is the document onboarding form. The UI should collect:

- document ID
- tenant ID
- issuer key ID
- content fingerprint
- policy JSON or a structured policy editor
- embedded AI tags
- initial history event(s)
- signed manifest blob

---

### 3. `POST /documents/{document_id}/events`

Appends one signed history event to an existing document.

#### Path parameter

- `document_id`: the document being updated

#### Request body

```json
{
  "event_id": "evt_confirmed_002",
  "document_id": "doc_7f92ab31",
  "event": "confirmed_received",
  "actor_org": "BuyerCo",
  "actor_key_id": "key_acme_primary",
  "timestamp": "2026-06-20T19:10:00Z",
  "previous_event_hash": "sha256:tip-from-previous-event",
  "manifest_hash": "sha256:...",
  "payload": {
    "note": "Buyer confirmed receipt"
  },
  "signature": "ed25519:..."
}
```

#### Response

```json
{
  "document_id": "doc_7f92ab31",
  "event_id": "evt_confirmed_002",
  "accepted": true,
  "history_tip": "sha256:..."
}
```

#### Notes

- `document_id` in the body must match the path parameter.
- `manifest_hash` must match the stored document manifest hash.
- `previous_event_hash` must match the current history tip.
- The event signature must verify with the actor public key.
- If the event type is `revoked`, the document status becomes `revoked`.

#### Common errors

- `404 Not Found` if the document or actor key does not exist.
- `409 Conflict` if any chain, hash, or signature check fails.

#### Frontend use

This is a “timeline update” form.
Good UI features:

- event type selector
- actor organization/key selector
- payload JSON editor
- auto-fill `previous_event_hash` from the latest document state
- signature status preview before submit

---

### 4. `POST /verify`

Verifies a signed manifest, the history chain, and the content fingerprint against the backend registry.

#### Request body

```json
{
  "document_id": "doc_verify",
  "signed_manifest": {
    "manifest": {
      "schema_version": "1.0",
      "tenant_id": "tenant_acme",
      "document_id": "doc_verify",
      "issuer_key_id": "key_acme_primary",
      "content_fingerprint": "sha256:verified",
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
    },
    "manifest_signature": "ed25519:...",
    "signature_algorithm": "Ed25519"
  },
  "history": [],
  "computed_content_fingerprint": "sha256:verified",
  "usage_context": {
    "operation": "external_ai_upload",
    "app": "reference_ai_gateway"
  }
}
```

#### Response

```json
{
  "status": "valid",
  "document_id": "doc_verify",
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
    "Content fingerprint matches",
    "NO_EXTERNAL_AI"
  ]
}
```

#### Verification statuses

The backend can return:

- `valid`
- `tampered`
- `revoked`
- `metadata_stripped`
- `unverifiable_rebuilt_copy`
- `unknown_document`
- `invalid_signature`

#### Policy behavior

The verification endpoint also returns a policy decision. Current logic checks:

- `external_ai_upload == blocked`
- embedded tag `NO_EXTERNAL_AI`
- `secure_link_required` combined with `direct_share`

#### Common errors

This endpoint usually returns `200` with a status payload rather than throwing for ordinary verification failures.
It only throws if there is an unexpected backend error.

#### Frontend use

This is the main “verify document” screen.
The frontend should allow the user to:

- paste or upload a signed manifest
- paste or upload history events
- provide the computed fingerprint of the file
- choose a usage context like `external_ai_upload` or `direct_share`
- show a clear pass/fail result with reasons

---

### 5. `POST /access-events`

Records a telemetry event for a document access action and recomputes risk.

#### Request body

```json
{
  "event_id": "acc_001",
  "tenant_id": "tenant_acme",
  "document_id": "doc_telemetry",
  "link_id": "link_buyerco_001",
  "timestamp": "2026-06-20T20:00:00Z",
  "action": "download",
  "ip_hash": "sha256:ip",
  "user_agent_hash": "sha256:ua",
  "country": "US",
  "result": "allowed",
  "reason": null
}
```

#### Response

```json
{
  "accepted": true,
  "event_id": "acc_001",
  "risk_recomputed": true
}
```

#### Notes

- The document must exist.
- The backend recalculates a risk score after storing the event.
- Risk scoring currently looks at recent downloads, bursts, geographic spread, and blocked attempts.

#### Common errors

- `404 Not Found` if the document does not exist.

#### Frontend use

This is usually called by an internal admin dashboard, not by end users.
Useful UI patterns:

- log viewer
- access event table
- risk score badge
- filters by date, document, country, and result

---

### 6. `GET /dashboard`

Returns high-level tenant telemetry and alert data.

#### Query parameters

- `tenant_id` required
- `document_id` optional
- `from` optional datetime
- `to` optional datetime

#### Example

```text
GET /dashboard?tenant_id=tenant_acme&document_id=doc_telemetry
```

#### Response

```json
{
  "tenant_id": "tenant_acme",
  "documents": 1,
  "access_events": 10,
  "alerts": [
    {
      "document_id": "doc_telemetry",
      "severity": "medium",
      "reason_codes": ["download_spike"],
      "score": 50
    }
  ],
  "recent_activity": [
    {
      "document_id": "doc_telemetry",
      "timestamp": "2026-06-20T20:00:00Z",
      "action": "download",
      "country": "US"
    }
  ]
}
```

#### Notes

- Alerts are generated when the computed score is at least 50.
- Recent activity is limited to the latest 20 access events.

#### Frontend use

This powers the admin dashboard home screen.
Use it for:

- summary cards
- alerts list
- recent activity feed
- date range filters

---

### 7. `GET /audit-export`

Returns a structured audit package for one document.

#### Query parameters

- `tenant_id` required
- `document_id` required

#### Example

```text
GET /audit-export?tenant_id=tenant_acme&document_id=doc_telemetry
```

#### Response

```json
{
  "tenant_id": "tenant_acme",
  "document_id": "doc_telemetry",
  "manifest": {
    "document_id": "doc_telemetry"
  },
  "manifest_hash": "sha256:...",
  "history": [],
  "revocation": {
    "document_revoked": false,
    "revoked_keys": []
  },
  "access_events": [],
  "risk_signals": [
    {
      "score": 50,
      "reasons": ["download_spike"]
    }
  ],
  "verification_summary": {
    "last_status": null,
    "last_verified_at": null
  }
}
```

#### Notes

- This is the best endpoint for exporting a full audit report.
- It includes manifest data, history, access events, revocation info, risk signals, and the last verification summary.

#### Frontend use

Use this for:

- export/download page
- “document details” drill-down
- compliance review UI

---

## Framework-Provided Endpoints

FastAPI also exposes these built-in routes:

- `GET /docs`
- `GET /redoc`
- `GET /openapi.json`

These are useful for development and can help drive frontend client generation.

## Recommended Frontend Architecture

The repo currently contains only the backend, so the frontend needs to be built from scratch.
The cleanest approach is a small single-page app with a typed API client and 4 to 5 focused screens.

### Suggested stack

- React or Next.js
- TypeScript
- a lightweight form library or plain controlled forms
- a fetch wrapper around `fetch` or `axios`
- a table library only if the dashboard gets large

### Suggested pages

1. Setup
2. Register Document
3. Append Event
4. Verify Document
5. Dashboard
6. Audit Export

### Suggested component breakdown

- `api/`
  - `setup.ts`
  - `documents.ts`
  - `verify.ts`
  - `telemetry.ts`
- `pages/` or `app/`
  - one page per workflow
- `components/`
  - JSON editor
  - signature status panel
  - policy badge group
  - risk score card
  - timeline table

## Frontend Data Flow

### 1. Setup flow

1. User enters tenant info.
2. User defines a policy template.
3. User pastes or uploads one or more public keys.
4. Frontend `POST`s to `/setup`.
5. On success, show the registered tenant summary.

### 2. Document registration flow

1. User fills manifest fields.
2. Frontend signs or receives a pre-signed manifest.
3. User enters the initial signed history event.
4. Frontend `POST`s to `/documents`.
5. Save the returned `document_id`, `manifest_hash`, and `history_tip`.

### 3. History event flow

1. Frontend loads the current `history_tip`.
2. User creates the next event.
3. Frontend signs the event.
4. Frontend `POST`s to `/documents/{document_id}/events`.
5. Update the UI timeline from the response.

### 4. Verification flow

1. User uploads or pastes the signed manifest.
2. User supplies the history chain and computed fingerprint.
3. User selects the operation context.
4. Frontend `POST`s to `/verify`.
5. Render the returned `status`, `policy_decision`, and `reasons`.

### 5. Telemetry flow

1. Access events are recorded as documents are used.
2. Frontend `POST`s to `/access-events`.
3. Dashboard polls or refreshes `/dashboard`.
4. Audit details come from `/audit-export`.

## Frontend UX Recommendations

### Make the data explicit

These objects are security-heavy and very schema-driven.
Show the user the actual JSON they are sending, at least in an advanced view.

### Show signing state clearly

Whenever the user edits a manifest or event, make it obvious whether:

- the content hash changed
- the signature is stale
- the event chain tip no longer matches

### Keep verification results readable

The `/verify` endpoint returns many booleans and a reason list.
Present it as:

- headline status
- green/red checks for fingerprint, manifest signature, and chain
- policy decision callout
- compact reason list

### Treat the dashboard as operations, not marketing

This UI should optimize for:

- speed
- clarity
- alerts
- exportability

## Example API Client Pattern

```ts
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}
```

## Example Frontend Screens

### Setup page

- tenant ID
- organization name
- domains
- admin emails
- policy template editor
- public key list

### Document page

- manifest form
- initial history event form
- signed manifest preview
- current history tip

### Verify page

- signed manifest import
- history chain import
- computed fingerprint input
- usage context selector
- verification result panel

### Dashboard page

- tenant filter
- date range filter
- alert table
- recent activity feed
- document drill-down link

### Audit page

- document search
- export button
- manifest preview
- full history list
- access event table
- revocation summary
- verification summary

## Practical Implementation Notes

- Keep request/response types in a shared TypeScript types file.
- Match the backend enum literals exactly, especially `status`, `event`, `action`, and `operation`.
- Parse and format ISO timestamps consistently as UTC.
- Use optimistic UI only for local draft edits, not for verification or signing results.
- Surface 404 and 409 errors clearly because they usually indicate user data issues, not server crashes.

## Suggested Build Order

1. Build the API client.
2. Build the Setup page.
3. Build the Document Registration page.
4. Build the Verify page.
5. Build the Dashboard and Audit Export pages.
6. Add polish, routing, and error states.

## Quick Test Checklist

- `POST /setup` creates the tenant successfully
- `POST /documents` registers a document
- `POST /documents/{document_id}/events` advances the history tip
- `POST /verify` returns `valid` for a clean document
- `POST /access-events` records telemetry
- `GET /dashboard` returns document and access counts
- `GET /audit-export` returns the full document audit bundle


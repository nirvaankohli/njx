# DocShield Signature Implementation

## Goal

Implement both of the following, with clear product language and technical boundaries:

1. A portable PDF mode with a hidden, signed, tamper-evident passport.
2. A secure-link-only mode for stronger control when the file should not rely on downstream PDF behavior.

This design deliberately avoids impossible claims. The PDF mode should be described as hidden, layered, and tamper-evident. It should not be described as unremovable. Stronger control comes from the secure-link mode, not from PDF watermarking alone.

## Product Positioning

Use these two modes together:

- `Protected PDF`
  The customer gets a downloadable PDF with an embedded hidden passport, signing history, and verification data.
- `Secure Link`
  The customer distributes the document through a controlled access path with telemetry, token enforcement, revocation, and per-recipient session checks.

The portable PDF gives provenance and policy transport. The secure-link path gives stronger operational control.

## What We Are Signing

Do not sign raw PDF bytes directly as the primary document identity. PDF producers often rewrite object ordering, metadata, xref tables, or incremental updates in ways that break byte-for-byte stability.

Instead, sign a canonical DocShield manifest that contains:

- `schema_version`
- `tenant_id`
- `document_id`
- `issuer_key_id`
- `content_fingerprint`
- `policy`
- `embedded_ai_tags`
- `history`
- `created_at`

The `content_fingerprint` should be computed locally before the document leaves the customer-controlled environment.

## Signature Strategy

Use `Ed25519` for the manifest and signing-history chain.

Why:

- small signatures
- simple implementation
- strong modern defaults
- good fit for append-only signed events

Each history event should be chained with `previous_event_hash` so lifecycle actions remain append-only and verifiable.

## Canonical Manifest Shape

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
    "NO_EXTERNAL_AI"
  ],
  "history": [
    {
      "event_id": "evt_issued_001",
      "event": "issued",
      "actor_org": "SupplierCo",
      "actor_key_id": "key_supplierco_primary",
      "timestamp": "2026-06-20T18:30:00Z",
      "signature": "ed25519:<signature>"
    }
  ],
  "created_at": "2026-06-20T18:30:00Z"
}
```

Before signing, serialize the manifest with canonical JSON rules. Use a stable canonicalization scheme so the same logical manifest always produces the same bytes before signature generation and verification.

## Two-Layer Architecture

### 1. Hidden passport inside the PDF

Embed the same signed manifest in more than one place so verification is resilient to casual metadata loss:

- XMP metadata packet
- embedded file attachment such as `docshield-manifest.json`
- custom PDF catalog reference or names tree entry
- incremental update marker for later event appends

This is not for secrecy against a determined attacker. It is for portability, extraction, and redundancy.

### 2. Secure-link control plane

Store only non-content metadata in the backend:

- manifest hash
- public keys
- revocation state
- link state
- access telemetry
- anomaly signals

The secure-link mode should be the stronger control path for:

- recipient-specific access
- link expiration
- token validation
- telemetry
- anomaly detection
- revocation

## Hidden Marking Strategy

The hidden marking layer should support two classes of signals:

### A. Durable hidden passport

This is the primary verification mechanism.

- embedded manifest
- signature chain
- document ID
- policy tags

### B. Fragile forensic markers

These are optional and should be treated as best-effort signals, not guarantees.

- low-salience vector markers
- object ordering markers
- tiny layout variations
- per-recipient tokenized page artifacts

These help identify controlled-share derivatives when the file survives mostly intact, but they should not be described as guaranteed to survive print-scan, rasterization, or full rebuild workflows.

## Verification Outcomes

The verifier should return one of these clear states:

- `valid`
  Manifest extracted, signature chain valid, content fingerprint matches, key not revoked.
- `tampered`
  Manifest extracted, but content fingerprint or chain validation fails.
- `revoked`
  Manifest and signature are structurally valid, but the key or document is revoked.
- `metadata_stripped`
  Expected DocShield passport missing from the PDF.
- `unverifiable_rebuilt_copy`
  File appears to have been rebuilt or flattened in a way that removed the passport.

This is a better user story than claiming the watermark cannot be removed.

## Repo Implementation Shape

For this Electron app, keep the seam small and place document processing in the main process.

### Main process

Add a `docshield` module under `src/main`:

- `src/main/docshield/service.ts`
- `src/main/docshield/pdf.ts`
- `src/main/docshield/signature.ts`
- `src/main/docshield/manifest.ts`
- `src/main/docshield/types.ts`

Responsibilities:

- compute fingerprints
- canonicalize manifest JSON
- sign manifests and events
- embed and extract passport data
- append history entries
- verify documents

### Shared contracts

Add shared DTOs in:

- `src/shared/docshield.ts`

Responsibilities:

- request and response types
- manifest and policy types
- verification result types
- IPC channel constants

### Preload bridge

Expose a narrow typed surface in:

- `src/preload/index.ts`

Suggested API:

```ts
window.veyr.docshield.protectPdf(...)
window.veyr.docshield.appendSignatureEvent(...)
window.veyr.docshield.verifyPdf(...)
window.veyr.docshield.extractPassport(...)
window.veyr.docshield.createSecureShare(...)
window.veyr.docshield.revokeDocument(...)
```

### IPC wiring

Register handlers in main-process IPC, following the existing thin-handler style already used by chat, theme, and provider flows.

Suggested channels:

- `docshield:protect-pdf`
- `docshield:append-signature-event`
- `docshield:verify-pdf`
- `docshield:extract-passport`
- `docshield:create-secure-share`
- `docshield:revoke-document`

### Renderer

Add a focused feature slice under:

- `src/mainview/features/docshield/`

Suggested screens:

- protect document flow
- policy selection
- signature history viewer
- verification result panel
- secure-link issuance screen
- revocation screen

Keep all PDF processing out of the renderer.

## Suggested Interface

```ts
type ProtectPdfRequest = {
  inputPath: string;
  outputPath: string;
  tenantId: string;
  issuerKeyId: string;
  policy: DocShieldPolicy;
  recipient?: {
    id: string;
    label: string;
  };
};

type ProtectPdfResult = {
  outputPath: string;
  manifest: DocShieldManifest;
  embeddedLocations: string[];
};

type AppendSignatureEventRequest = {
  pdfPath: string;
  event: SignatureHistoryEventInput;
};

type VerifyPdfRequest = {
  pdfPath: string;
};

type VerifyPdfResult = {
  status:
    | "valid"
    | "tampered"
    | "revoked"
    | "metadata_stripped"
    | "unverifiable_rebuilt_copy";
  documentId?: string;
  manifest?: DocShieldManifest;
  fingerprintMatch: boolean;
  signatureChainValid: boolean;
  revoked: boolean;
  reasons: string[];
};
```

## Protect PDF Flow

1. Load the local PDF from a customer-controlled path.
2. Compute a stable `content_fingerprint`.
3. Build the canonical manifest.
4. Sign the manifest root with the issuer key.
5. Embed the manifest in multiple hidden PDF locations.
6. Optionally add fragile forensic markers for recipient-specific copies.
7. Store only non-content metadata in the backend.
8. Return the protected PDF path and manifest summary.

## Append Signing Event Flow

1. Extract the existing passport.
2. Validate the current signature chain before appending.
3. Build a new event with `previous_event_hash`.
4. Sign the new event.
5. Re-embed the updated manifest using an incremental update when possible.
6. Register the updated manifest hash or history tip with the backend.

## Verify Flow

1. Extract every DocShield payload location available in the PDF.
2. Resolve the best candidate manifest.
3. Canonicalize and verify signatures.
4. Recompute the local fingerprint.
5. Check revocation state with the backend, with a cached-key fallback for degraded operation.
6. Return a precise verification status with human-readable reasons.

## Secure-Link Mode

The secure-link mode should not just serve a raw file URL.

Implement:

- per-recipient link IDs
- token or signed URL validation
- expiration
- download or open event capture
- hashed IP and hashed user-agent logging
- country derivation
- repeated failure counting
- revocation enforcement

Recommended behavior:

- If policy says `secure_link_required = true`, the UI should discourage or block naked file export where appropriate.
- The secure-link path should optionally generate a recipient-specific protected copy with fragile forensic markers.

## Key Management

For MVP:

- generate tenant signing keys locally
- store private keys only in the customer environment
- register only public keys and key IDs with the backend

Later:

- KMS-backed signing
- hardware-backed keys
- delegated signer roles
- automated rotation

## PDF Library Expectations

Pick a library that supports:

- reading and writing PDF metadata
- incremental updates
- embedded attachments
- low-level object access when needed

If one library does not cover the full path cleanly, keep a stable internal module seam and hide library-specific behavior inside `src/main/docshield/pdf.ts`.

## Honesty Rules For UI And Marketing

Do not say:

- unremovable watermark
- guaranteed hidden tracking
- universal offline tracking

Do say:

- hidden signed passport
- layered verification
- tamper-evident provenance
- controlled-share telemetry
- stronger protection through secure-link distribution

## MVP Recommendation

Build both, but stage them in this order:

1. manifest canonicalization and Ed25519 signing
2. PDF hidden passport embedding and extraction
3. verification and revocation checks
4. signature-history append flow
5. secure-link issuance and telemetry
6. optional fragile forensic recipient markers

This gives a credible MVP quickly while keeping the trust model honest.

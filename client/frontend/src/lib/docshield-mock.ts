// Local mock data used when no DocShield backend is configured.
// Lets the UI render meaningfully during pilots / demos.
import type {
  AccessEvent,
  DashboardData,
  DocumentManifest,
  SignedHistoryEventPayload,
  VerifyResult,
} from "./docshield-api";

export const mockDocuments: DocumentManifest[] = [
  {
    document_id: "doc_7f92ab31",
    tenant_id: "tenant_acme",
    content_fingerprint: "sha256:4b9a…e21f",
    policy: {
      external_ai_upload: "blocked",
      secure_link_required: true,
      forwarding: "blocked",
      public_sharing: "blocked",
    },
    embedded_ai_tags: ["NO_EXTERNAL_AI"],
    signer_refs: ["key_supplierco_01"],
    created_at: "2026-06-18T14:21:00Z",
    status: "active",
  },
  {
    document_id: "doc_3aa11c08",
    tenant_id: "tenant_acme",
    content_fingerprint: "sha256:91cd…77a2",
    policy: {
      external_ai_upload: "blocked",
      secure_link_required: true,
      forwarding: "allowed",
      public_sharing: "blocked",
    },
    embedded_ai_tags: ["NO_EXTERNAL_AI"],
    signer_refs: ["key_buyerco_02"],
    created_at: "2026-06-19T09:02:00Z",
    status: "active",
  },
];

export const mockHistory: Record<string, SignedHistoryEventPayload[]> = {
  doc_7f92ab31: [
    {
      event_id: "evt_001",
      document_id: "doc_7f92ab31",
      event: "issued",
      actor_org: "SupplierCo",
      actor_key_id: "key_supplierco_01",
      timestamp: "2026-06-18T14:30:00Z",
      signature: "ed25519:9ab1…",
      manifest_hash: "sha256:demo-issued",
      payload: {},
    },
    {
      event_id: "evt_002",
      document_id: "doc_7f92ab31",
      event: "sent",
      actor_org: "SupplierCo",
      actor_key_id: "key_supplierco_01",
      timestamp: "2026-06-18T14:35:00Z",
      previous_event_hash: "sha256:aa11…",
      signature: "ed25519:1c2d…",
      manifest_hash: "sha256:demo-issued",
      payload: {},
    },
    {
      event_id: "evt_003",
      document_id: "doc_7f92ab31",
      event: "confirmed_received",
      actor_org: "BuyerCo",
      actor_key_id: "key_buyerco_02",
      timestamp: "2026-06-19T09:10:00Z",
      previous_event_hash: "sha256:bb22…",
      signature: "ed25519:7f81…",
      manifest_hash: "sha256:demo-issued",
      payload: {},
    },
  ],
};

export const mockAccessEvents: AccessEvent[] = [
  {
    event_id: "ae_01",
    tenant_id: "tenant_acme",
    document_id: "doc_7f92ab31",
    link_id: "lnk_alpha",
    timestamp: "2026-06-19T11:02:00Z",
    ip_hash: "h:8a3…",
    user_agent_hash: "h:e22…",
    country: "US",
    action: "open",
    result: "allowed",
  },
  {
    event_id: "ae_02",
    tenant_id: "tenant_acme",
    document_id: "doc_7f92ab31",
    link_id: "lnk_alpha",
    timestamp: "2026-06-19T11:04:11Z",
    ip_hash: "h:8a3…",
    user_agent_hash: "h:e22…",
    country: "US",
    action: "download",
    result: "allowed",
  },
  {
    event_id: "ae_03",
    tenant_id: "tenant_acme",
    document_id: "doc_3aa11c08",
    link_id: "lnk_beta",
    timestamp: "2026-06-19T18:44:00Z",
    ip_hash: "h:f01…",
    user_agent_hash: "h:9b1…",
    country: "DE",
    action: "open",
    result: "allowed",
  },
  {
    event_id: "ae_04",
    tenant_id: "tenant_acme",
    document_id: "doc_3aa11c08",
    link_id: "lnk_beta",
    timestamp: "2026-06-20T02:14:00Z",
    ip_hash: "h:c10…",
    user_agent_hash: "h:9b1…",
    country: "RU",
    action: "token_failed",
    result: "failed",
  },
];

export const mockDashboard: DashboardData = {
  tenant_id: "tenant_acme",
  documents: 2,
  access_events: 4,
  alerts: [
    {
      document_id: "doc_3aa11c08",
      reason_codes: ["unusual_geography", "off_hours_access"],
      severity: "high",
      score: 72,
    },
    {
      document_id: "doc_7f92ab31",
      reason_codes: ["repeated_downloads"],
      severity: "low",
      score: 28,
    },
  ],
  recent_activity: [
    { document_id: "doc_7f92ab31", timestamp: "2026-06-19T11:02:00Z", action: "open", country: "US" },
    { document_id: "doc_7f92ab31", timestamp: "2026-06-19T11:04:11Z", action: "download", country: "US" },
    { document_id: "doc_3aa11c08", timestamp: "2026-06-19T18:44:00Z", action: "open", country: "DE" },
    { document_id: "doc_3aa11c08", timestamp: "2026-06-20T02:14:00Z", action: "token_failed", country: "RU" },
  ],
};

export function mockVerify(documentId: string, fingerprint: string): VerifyResult {
  const doc = mockDocuments.find((d) => d.document_id === documentId);
  const matches = !!doc && fingerprint.trim() === doc.content_fingerprint;
  return {
    status: matches ? "valid" : doc ? "tampered" : "unknown_document",
    document_id: documentId,
    fingerprint_match: matches,
    manifest_signature_valid: !!doc,
    signature_chain_valid: !!doc && matches,
    revoked: doc?.status === "revoked",
    policy_decision: {
      operation: "external_ai_upload",
      allowed: !!doc && matches,
      reason: matches ? null : "fingerprint_mismatch",
    },
    reasons: doc
      ? matches
        ? ["signature_valid", "manifest_intact"]
        : ["fingerprint_mismatch"]
      : ["unknown_document"],
  };
}

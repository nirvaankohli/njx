// Local mock data used when no DocShield backend is configured.
// Lets the UI render meaningfully during pilots / demos.
import type {
  AccessEvent,
  DashboardData,
  DocumentManifest,
  HistoryEvent,
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
    embedded_ai_tags: ["NO_EXTERNAL_AI", "SECURE_LINK_ONLY"],
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

export const mockHistory: Record<string, HistoryEvent[]> = {
  doc_7f92ab31: [
    {
      event_id: "evt_001",
      action: "issued",
      actor_org: "SupplierCo",
      actor_key_id: "key_supplierco_01",
      timestamp: "2026-06-18T14:30:00Z",
      signature: "ed25519:9ab1…",
    },
    {
      event_id: "evt_002",
      action: "sent",
      actor_org: "SupplierCo",
      actor_key_id: "key_supplierco_01",
      timestamp: "2026-06-18T14:35:00Z",
      previous_event_hash: "sha256:aa11…",
      signature: "ed25519:1c2d…",
    },
    {
      event_id: "evt_003",
      action: "confirmed",
      actor_org: "BuyerCo",
      actor_key_id: "key_buyerco_02",
      timestamp: "2026-06-19T09:10:00Z",
      previous_event_hash: "sha256:bb22…",
      signature: "ed25519:7f81…",
    },
  ],
};

export const mockAccessEvents: AccessEvent[] = [
  {
    event_id: "ae_01",
    document_id: "doc_7f92ab31",
    link_id: "lnk_alpha",
    timestamp: "2026-06-19T11:02:00Z",
    ip_hash: "h:8a3…",
    user_agent_hash: "h:e22…",
    country: "US",
    action: "opened",
  },
  {
    event_id: "ae_02",
    document_id: "doc_7f92ab31",
    link_id: "lnk_alpha",
    timestamp: "2026-06-19T11:04:11Z",
    ip_hash: "h:8a3…",
    user_agent_hash: "h:e22…",
    country: "US",
    action: "downloaded",
  },
  {
    event_id: "ae_03",
    document_id: "doc_3aa11c08",
    link_id: "lnk_beta",
    timestamp: "2026-06-19T18:44:00Z",
    ip_hash: "h:f01…",
    user_agent_hash: "h:9b1…",
    country: "DE",
    action: "opened",
  },
  {
    event_id: "ae_04",
    document_id: "doc_3aa11c08",
    link_id: "lnk_beta",
    timestamp: "2026-06-20T02:14:00Z",
    ip_hash: "h:c10…",
    user_agent_hash: "h:9b1…",
    country: "RU",
    action: "failed",
  },
];

export const mockDashboard: DashboardData = {
  totals: { documents: 2, access_events: 4, risk_signals: 2 },
  anomaly_score: 37,
  recent_events: mockAccessEvents,
  risk_signals: [
    {
      document_id: "doc_3aa11c08",
      score: 72,
      reason_codes: ["unusual_geography", "off_hours_access"],
      severity: "high",
      generated_at: "2026-06-20T02:15:00Z",
    },
    {
      document_id: "doc_7f92ab31",
      score: 28,
      reason_codes: ["repeated_downloads"],
      severity: "low",
      generated_at: "2026-06-19T11:06:00Z",
    },
  ],
  geography: [
    { country: "US", count: 2 },
    { country: "DE", count: 1 },
    { country: "RU", count: 1 },
  ],
};

export function mockVerify(documentId: string, fingerprint: string): VerifyResult {
  const doc = mockDocuments.find((d) => d.document_id === documentId);
  const matches = !!doc && fingerprint.trim() === doc.content_fingerprint;
  return {
    document_id: documentId,
    authentic: matches,
    tampered: !!doc && !matches,
    revoked: doc?.status === "revoked",
    policy:
      doc?.policy ?? {
        external_ai_upload: "blocked",
        secure_link_required: true,
        forwarding: "blocked",
        public_sharing: "blocked",
      },
    embedded_ai_tags: doc?.embedded_ai_tags ?? [],
    reason_codes: doc
      ? matches
        ? ["signature_valid", "manifest_intact"]
        : ["fingerprint_mismatch"]
      : ["unknown_document"],
  };
}

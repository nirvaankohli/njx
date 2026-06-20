import { getDocShieldSession } from "./docshield-session";
import type { DocShieldSession } from "./docshield-session";

const BASE = (import.meta.env.VITE_DOCSHIELD_API_BASE as string | undefined) ?? "/api";

export type PolicyTemplate = {
  external_ai_upload: "blocked" | "allowed";
  secure_link_required: boolean;
  forwarding: "blocked" | "allowed";
  public_sharing: "blocked" | "allowed";
};

export type AiTag =
  | "NO_EXTERNAL_AI"
  | "SECURE_LINK_ONLY"
  | "NO_FORWARDING"
  | "PUBLIC_SHARING_BLOCKED";

export type DocumentManifest = {
  document_id: string;
  tenant_id: string;
  content_fingerprint: string;
  policy: PolicyTemplate;
  embedded_ai_tags: AiTag[];
  signer_refs: string[];
  created_at?: string;
  status?: "active" | "revoked";
};

export type TenantSetupRequest = {
  tenant: {
    tenant_id: string;
    org_name: string;
    domains: string[];
    admin_emails: string[];
    status?: "active" | "disabled";
  };
  policy_templates: {
    policy_id: string;
    name: string;
    policy: PolicyTemplate;
  }[];
  public_keys: {
    key_id: string;
    algorithm?: "Ed25519";
    public_key_b64: string;
    status?: "active" | "revoked";
  }[];
};

export type SetupResponse = {
  tenant_id: string;
  status: "active" | "disabled";
  registered_policy_templates: number;
  registered_public_keys: number;
};

export type SignedManifestPayload = {
  manifest: {
    schema_version?: string;
    tenant_id: string;
    document_id: string;
    issuer_key_id: string;
    content_fingerprint: string;
    policy: PolicyTemplate;
    embedded_ai_tags: AiTag[];
    created_at: string;
  };
  manifest_signature: string;
  signature_algorithm: "Ed25519";
};

export type SignedHistoryEventPayload = {
  event_id: string;
  document_id: string;
  event:
    | "issued"
    | "sent"
    | "received"
    | "confirmed_received"
    | "approved"
    | "reissued"
    | "revoked";
  actor_org: string;
  actor_key_id: string;
  timestamp: string;
  previous_event_hash?: string | null;
  manifest_hash: string;
  payload: Record<string, unknown>;
  signature: string;
};

export type DocumentRegistrationRequest = {
  signed_manifest: SignedManifestPayload;
  initial_history: SignedHistoryEventPayload[];
};

export type DocumentRegistrationResponse = {
  document_id: string;
  manifest_hash: string;
  status: "registered";
  history_tip: string;
};

export type HistoryAppendResponse = {
  document_id: string;
  event_id: string;
  accepted: boolean;
  history_tip: string;
};

export type VerifyRequest = {
  document_id: string;
  signed_manifest: SignedManifestPayload;
  history: SignedHistoryEventPayload[];
  computed_content_fingerprint: string;
  usage_context: {
    operation: string;
    app?: string | null;
  };
};

export type VerifyResult = {
  status:
    | "valid"
    | "tampered"
    | "revoked"
    | "metadata_stripped"
    | "unverifiable_rebuilt_copy"
    | "unknown_document"
    | "invalid_signature";
  document_id: string;
  fingerprint_match: boolean;
  manifest_signature_valid: boolean;
  signature_chain_valid: boolean;
  revoked: boolean;
  policy_decision: {
    operation: string;
    allowed: boolean;
    reason: string | null;
  };
  reasons: string[];
};

export type AccessEvent = {
  event_id: string;
  tenant_id: string;
  document_id: string;
  link_id?: string | null;
  timestamp: string;
  action: "open" | "download" | "token_failed" | "verify_attempt" | "ai_upload_blocked";
  ip_hash?: string | null;
  user_agent_hash?: string | null;
  country?: string | null;
  result?: "allowed" | "blocked" | "failed";
  reason?: string | null;
};

export type AccessEventResponse = {
  accepted: boolean;
  event_id: string;
  risk_recomputed: boolean;
};

export type DashboardResponse = {
  tenant_id: string;
  documents: number;
  access_events: number;
  alerts: {
    document_id: string;
    severity: "low" | "medium" | "high";
    reason_codes: string[];
    score: number;
  }[];
  recent_activity: {
    document_id: string;
    timestamp: string;
    action: string;
    country?: string | null;
  }[];
};

export type AuditExportResponse = {
  tenant_id: string;
  document_id: string;
  manifest: Record<string, unknown>;
  manifest_hash: string;
  history: Record<string, unknown>[];
  revocation: {
    document_revoked: boolean;
    revoked_keys: string[];
  };
  access_events: Record<string, unknown>[];
  risk_signals: Record<string, unknown>[];
  verification_summary: {
    last_status: string | null;
    last_verified_at: string | null;
  };
};

export type DashboardData = DashboardResponse;

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function joinUrl(base: string, path: string) {
  if (base.endsWith("/") && path.startsWith("/")) {
    return `${base.slice(0, -1)}${path}`;
  }
  if (!base.endsWith("/") && !path.startsWith("/")) {
    return `${base}/${path}`;
  }
  return `${base}${path}`;
}

export function buildUrl(path: string, query?: Record<string, string | number | boolean | null | undefined>) {
  const url = new URL(joinUrl(BASE, path), window.location.origin);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return BASE.startsWith("http") ? url.toString() : `${url.pathname}${url.search}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(buildUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, text || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  baseUrl: BASE,
  buildUrl,
  setup: (payload: TenantSetupRequest) =>
    request<SetupResponse>(`/setup`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  registerDocument: (payload: DocumentRegistrationRequest) =>
    request<DocumentRegistrationResponse>(`/documents`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  addHistory: (documentId: string, event: SignedHistoryEventPayload) =>
    request<HistoryAppendResponse>(`/documents/${encodeURIComponent(documentId)}/events`, {
      method: "POST",
      body: JSON.stringify(event),
    }),
  verify: (payload: VerifyRequest) =>
    request<VerifyResult>(`/verify`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  logAccessEvent: (event: AccessEvent) =>
    request<AccessEventResponse>(`/access-events`, {
      method: "POST",
      body: JSON.stringify(event),
    }),
  dashboard: (tenantId = getDocShieldSession().tenantId, documentId?: string) => {
    const query: Record<string, string> = { tenant_id: tenantId };
    if (documentId) query.document_id = documentId;
    return request<DashboardResponse>(buildQueryPath(`/dashboard`, query), { method: "GET" });
  },
  auditExport: (tenantId = getDocShieldSession().tenantId, documentId = getDocShieldSession().activeDocument?.documentId ?? "doc_7f92ab31") =>
    request<AuditExportResponse>(buildQueryPath(`/audit-export`, { tenant_id: tenantId, document_id: documentId }), {
      method: "GET",
    }),
  auditExportUrl: (tenantId = getDocShieldSession().tenantId, documentId = getDocShieldSession().activeDocument?.documentId ?? "doc_7f92ab31") =>
    buildUrl(`/audit-export`, { tenant_id: tenantId, document_id: documentId }),
};

function buildQueryPath(path: string, query: Record<string, string>) {
  const queryString = new URLSearchParams(query).toString();
  return queryString ? `${path}?${queryString}` : path;
}

export type { ApiError, DocShieldSession };

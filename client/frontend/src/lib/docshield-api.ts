import { getDocShieldSession } from "./docshield-session";
import { resolveClientContext } from "./docshield-client-context";
import type { DocShieldSession } from "./docshield-session";

const BASE = (import.meta.env.VITE_DOCSHIELD_API_BASE as string | undefined) ?? "/api";

export type PolicyTemplate = {
  external_ai_upload: "blocked" | "allowed";
  secure_link_required: boolean;
  forwarding: "blocked" | "allowed";
  public_sharing: "blocked" | "allowed";
};

export type AiTag =
  | "NO_EXTERNAL_AI";

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

export type DocumentSummary = {
  document_id: string;
  tenant_id: string;
  issuer_key_id: string;
  content_fingerprint: string;
  policy: PolicyTemplate;
  embedded_ai_tags: AiTag[];
  created_at: string;
  status: "active" | "revoked";
  file_name: string | null;
  content_type: string | null;
  size_bytes: number | null;
  access_method: "link" | "password" | "organization" | null;
  event_count: number;
};

export type DocumentDetail = DocumentSummary & {
  manifest: Record<string, unknown>;
  manifest_hash: string;
  history_tip: string;
  history: SignedHistoryEventPayload[];
  last_verified_status: string | null;
  last_verified_at: string | null;
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
  tenant_id: string | null;
  tenant_org_name: string | null;
  issuer_key_id: string | null;
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
  ip_address?: string | null;
  ip_hash?: string | null;
  user_agent_hash?: string | null;
  browser?: string | null;
  country?: string | null;
  result?: "allowed" | "blocked" | "failed";
  reason?: string | null;
};

export type AccessEventFeedItem = AccessEvent & {
  risk_score: number;
  risk_reasons: string[];
  severity: "low" | "medium" | "high";
  suspicious: boolean;
};

export type AccessEventResponse = {
  accepted: boolean;
  event_id: string;
  risk_recomputed: boolean;
};

export type AccessEventsFeedResponse = {
  tenant_id: string;
  total_events: number;
  suspicious_events: number;
  events: AccessEventFeedItem[];
};

export type ShareLinkResponse = {
  link_id: string;
  document_id: string;
  token: string;
  access_method: "link" | "password" | "organization";
  expires_at: string | null;
};

export type SharedDocument = {
  link_id: string;
  document_id: string;
  tenant_id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  content_fingerprint: string;
  issuer_key_id: string;
  access_method: "link" | "password" | "organization";
  password_required: boolean;
  expires_at: string | null;
};

export type ShareAnalytics = {
  document_id: string;
  opens: number;
  downloads: number;
  download_rate_per_hour: number;
  countries: Record<string, number>;
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
  documents: (
    tenantId = getDocShieldSession().tenantId,
    filters: { status?: "active" | "revoked"; query?: string } = {},
  ) =>
    request<DocumentSummary[]>(
      buildQueryPath("/documents", { tenant_id: tenantId, status: filters.status, query: filters.query }),
      { method: "GET" },
    ),
  document: (documentId: string, tenantId = getDocShieldSession().tenantId) =>
    request<DocumentDetail>(
      buildQueryPath(`/documents/${encodeURIComponent(documentId)}`, { tenant_id: tenantId }),
      { method: "GET" },
    ),
  deleteDocument: (documentId: string, tenantId = getDocShieldSession().tenantId) =>
    request<void>(
      buildQueryPath(`/documents/${encodeURIComponent(documentId)}`, { tenant_id: tenantId }),
      { method: "DELETE" },
    ),
  uploadDocumentContent: async (documentId: string, file: File) => {
    const response = await fetch(buildUrl(`/documents/${encodeURIComponent(documentId)}/content`), {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": file.name },
      body: file,
    });
    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new ApiError(response.status, message || `Request failed: ${response.status}`);
    }
  },
  createShareLink: (
    documentId: string,
    payload: { access_method: "link" | "password" | "organization"; password_hash?: string | null; expires_in_hours?: number },
  ) =>
    request<ShareLinkResponse>(`/documents/${encodeURIComponent(documentId)}/share-links`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  shareAnalytics: (documentId: string) =>
    request<ShareAnalytics>(`/documents/${encodeURIComponent(documentId)}/share-analytics`, { method: "GET" }),
  sharedDocument: async (token: string) => {
    const context = await resolveClientContext();
    return request<SharedDocument>(`/shares/${encodeURIComponent(token)}`, {
      method: "GET",
      headers: clientContextHeaders(context),
    });
  },
  sharedDownloadUrl: (token: string) => buildUrl(`/shares/${encodeURIComponent(token)}/download`),
  downloadSharedDocument: async (
    token: string,
    credentials: { passwordHash?: string; tenantId?: string } = {},
  ) => {
    const context = await resolveClientContext();
    const response = await fetch(buildUrl(`/shares/${encodeURIComponent(token)}/download`), {
      headers: {
        ...clientContextHeaders(context),
        ...(credentials.passwordHash ? { "X-Share-Password-Hash": credentials.passwordHash } : {}),
        ...(credentials.tenantId ? { "X-Tenant-ID": credentials.tenantId } : {}),
      },
    });
    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new ApiError(response.status, message || `Request failed: ${response.status}`);
    }
    return response.blob();
  },
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
  verifyFile: async (file: File, operation = "authenticity_check") => {
    const response = await fetch(buildUrl("/verify/file", { operation, app: "docshield_web" }), {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: file,
    });
    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new ApiError(response.status, message || `Request failed: ${response.status}`);
    }
    return (await response.json()) as VerifyResult;
  },
  logAccessEvent: (event: AccessEvent) =>
    request<AccessEventResponse>(`/access-events`, {
      method: "POST",
      body: JSON.stringify(event),
    }),
  accessEventsFeed: (tenantId = getDocShieldSession().tenantId, limit = 25) =>
    request<AccessEventsFeedResponse>(buildQueryPath(`/access-events`, { tenant_id: tenantId, limit }), {
      method: "GET",
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

function clientContextHeaders(context: { ipAddress?: string; country?: string }): Record<string, string> {
  return {
    ...(context.ipAddress ? { "X-Client-IP": context.ipAddress } : {}),
    ...(context.country ? { "X-Client-Country": context.country } : {}),
  };
}

function buildQueryPath(path: string, query: Record<string, string | undefined>) {
  const queryString = new URLSearchParams(
    Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString();
  return queryString ? `${path}?${queryString}` : path;
}

export type { ApiError, DocShieldSession };

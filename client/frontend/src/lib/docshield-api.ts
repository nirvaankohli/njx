// DocShield API client
// Wraps the backend endpoints described in the PRD. The base URL is configurable
// via VITE_DOCSHIELD_API_BASE so the frontend can be pointed at any blind backend.

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

export type SetupPayload = {
  tenant_id: string;
  tenant_name: string;
  domains: string[];
  policy_templates: { name: string; policy: PolicyTemplate }[];
  public_keys: { key_id: string; algorithm: string; public_key: string }[];
};

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

export type HistoryEvent = {
  event_id?: string;
  action: "issued" | "sent" | "received" | "confirmed" | "approved" | "reissued";
  actor_org: string;
  actor_key_id: string;
  timestamp: string;
  previous_event_hash?: string;
  signature: string;
};

export type VerifyResult = {
  document_id: string;
  authentic: boolean;
  tampered: boolean;
  revoked: boolean;
  policy: PolicyTemplate;
  embedded_ai_tags: AiTag[];
  reason_codes: string[];
};

export type AccessEvent = {
  event_id?: string;
  document_id: string;
  link_id: string;
  timestamp: string;
  ip_hash: string;
  user_agent_hash: string;
  country: string;
  action: "opened" | "downloaded" | "failed";
};

export type DashboardData = {
  totals: { documents: number; access_events: number; risk_signals: number };
  anomaly_score: number;
  recent_events: AccessEvent[];
  risk_signals: {
    document_id: string;
    score: number;
    reason_codes: string[];
    severity: "low" | "medium" | "high";
    generated_at: string;
  }[];
  geography: { country: string; count: number }[];
};

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
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
  setup: (payload: SetupPayload) =>
    request<{ ok: true; tenant_id: string }>(`/setup`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  registerDocument: (payload: Omit<DocumentManifest, "created_at" | "status">) =>
    request<DocumentManifest>(`/documents`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  addHistory: (documentId: string, event: HistoryEvent) =>
    request<HistoryEvent>(`/documents/${encodeURIComponent(documentId)}/events`, {
      method: "POST",
      body: JSON.stringify(event),
    }),
  verify: (payload: { document_id: string; content_fingerprint: string }) =>
    request<VerifyResult>(`/verify`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  logAccessEvent: (event: AccessEvent) =>
    request<AccessEvent>(`/access-events`, {
      method: "POST",
      body: JSON.stringify(event),
    }),
  dashboard: () => request<DashboardData>(`/dashboard`, { method: "GET" }),
  auditExport: () => request<{ url: string }>(`/audit-export`, { method: "GET" }),
};

export { ApiError };

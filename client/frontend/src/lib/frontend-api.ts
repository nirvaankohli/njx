const BASE = (import.meta.env.VITE_FRONTEND_API_BASE as string | undefined) ?? "/api";

function joinUrl(base: string, path: string) {
  if (base.endsWith("/") && path.startsWith("/")) {
    return `${base.slice(0, -1)}${path}`;
  }
  if (!base.endsWith("/") && !path.startsWith("/")) {
    return `${base}/${path}`;
  }
  return `${base}${path}`;
}

export function buildFrontendUrl(path: string) {
  const url = new URL(joinUrl(BASE, path), window.location.origin);
  return BASE.startsWith("http") ? url.toString() : `${url.pathname}${url.search}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(buildFrontendUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = typeof body?.detail === "string" ? body.detail : res.statusText;
    throw new Error(message || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type FrontendProfile = {
  user_id: string;
  full_name: string;
  email: string;
  job_title: string | null;
  avatar_url: string | null;
} | null;

export type FrontendUser = {
  id: string;
  email: string;
  full_name: string;
  job_title: string | null;
  avatar_url: string | null;
} | null;

export type FrontendCompanySettings = {
  id: string;
  user_id: string;
  company_name: string;
  company_website: string | null;
  company_size: string | null;
  industry: string | null;
  address: string | null;
  phone: string | null;
  company_logo_url: string | null;
  created_at: string;
  updated_at: string;
} | null;

export type FrontendSession = {
  user: FrontendUser;
  profile: FrontendProfile;
  company_settings: FrontendCompanySettings;
};

export type FrontendAuthRequest = {
  email: string;
  password?: string;
  full_name?: string;
};

export type FrontendCompanySettingsRequest = {
  company_name: string;
  company_website?: string | null;
  company_size?: string | null;
  industry?: string | null;
  address?: string | null;
  phone?: string | null;
  company_logo_url?: string | null;
};

export const frontendApi = {
  session: () => request<FrontendSession>("/frontend/session", { method: "GET" }),
  demoSignIn: () => request<FrontendSession>("/frontend/auth/demo", { method: "POST" }),
  signIn: (payload: FrontendAuthRequest) =>
    request<FrontendSession>("/frontend/auth/sign-in", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  signUp: (payload: FrontendAuthRequest) =>
    request<FrontendSession>("/frontend/auth/sign-up", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  signOut: () => request<{ ok: boolean }>("/frontend/session", { method: "DELETE" }),
  companySettings: () => request<FrontendCompanySettings>("/frontend/company-settings", { method: "GET" }),
  saveCompanySettings: (payload: FrontendCompanySettingsRequest) =>
    request<FrontendCompanySettings>("/frontend/company-settings", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

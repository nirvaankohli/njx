import type { SignedManifestPayload, SignedHistoryEventPayload } from "./docshield-api";

const STORAGE_KEY = "docshield-session";

export type DocShieldSession = {
  tenantId: string;
  tenantName: string;
  adminEmails: string[];
  domains: string[];
  issuerKeyId: string;
  activeDocument: {
    documentId: string;
    contentFingerprint: string;
    manifestHash: string;
    historyTip: string;
    signedManifest: SignedManifestPayload;
    history: SignedHistoryEventPayload[];
    sourceFileName?: string;
    sourceFileType?: string;
    sourceFileSize?: number;
    accessAnyoneWithLink?: boolean;
    accessMethod?: "password" | "organization" | null;
    accessPasswordHash?: string | null;
    shareLink?: {
      linkId: string;
      token: string;
      expiresAt: string | null;
    } | null;
  } | null;
};

export const DEFAULT_DOCSHIELD_SESSION: DocShieldSession = {
  tenantId: "tenant_acme",
  tenantName: "BediServices",
  adminEmails: ["nirvaan.kohli@gmail.com"],
  domains: ["bediservices.com"],
  issuerKeyId: "key_acme_primary",
  activeDocument: null,
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readStoredSession(): Partial<DocShieldSession> {
  if (!canUseStorage()) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<DocShieldSession>) : {};
  } catch {
    return {};
  }
}

function writeStoredSession(session: DocShieldSession) {
  if (!canUseStorage()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function getDocShieldSession(): DocShieldSession {
  return {
    ...DEFAULT_DOCSHIELD_SESSION,
    ...readStoredSession(),
    activeDocument: readStoredSession().activeDocument ?? DEFAULT_DOCSHIELD_SESSION.activeDocument,
  };
}

export function updateDocShieldSession(partial: Partial<DocShieldSession>): DocShieldSession {
  const next = {
    ...getDocShieldSession(),
    ...partial,
    activeDocument:
      partial.activeDocument === undefined
        ? getDocShieldSession().activeDocument
        : partial.activeDocument,
  };
  writeStoredSession(next);
  return next;
}

export function setDocShieldActiveDocument(
  activeDocument: NonNullable<DocShieldSession["activeDocument"]>,
): DocShieldSession {
  return updateDocShieldSession({ activeDocument });
}

export function clearDocShieldActiveDocument(): DocShieldSession {
  return updateDocShieldSession({ activeDocument: null });
}

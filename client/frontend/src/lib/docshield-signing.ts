import { getDocShieldSession, updateDocShieldSession } from "./docshield-session";

const KEYPAIR_STORAGE_KEY = "docshield-dev-signing-keypair";
const ENCODER = new TextEncoder();

type StoredKeypair = {
  publicKeyB64: string;
  privateKeyPkcs8B64: string;
  keyId: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function bytesToBase64(bytes: ArrayBuffer | Uint8Array) {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  array.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const next = canonicalize((value as Record<string, unknown>)[key]);
        if (next !== undefined) {
          acc[key] = next;
        }
        return acc;
      }, {});
  }
  return value;
}

export function canonicalJsonString(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export async function sha256Hex(value: string | Uint8Array | ArrayBuffer) {
  const bytes =
    typeof value === "string" ? ENCODER.encode(value) : value instanceof Uint8Array ? value : new Uint8Array(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${bytesToHex(new Uint8Array(digest))}`;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function loadStoredKeypair(): Promise<StoredKeypair | null> {
  if (!canUseStorage()) return null;
  const raw = localStorage.getItem(KEYPAIR_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredKeypair;
  } catch {
    return null;
  }
}

async function saveStoredKeypair(keypair: StoredKeypair) {
  if (!canUseStorage()) return;
  localStorage.setItem(KEYPAIR_STORAGE_KEY, JSON.stringify(keypair));
}

export async function ensureDevSigningIdentity() {
  const session = getDocShieldSession();
  const stored = await loadStoredKeypair();
  if (stored) {
    if (session.issuerKeyId !== stored.keyId) {
      updateDocShieldSession({ issuerKeyId: stored.keyId });
    }
    return stored;
  }

  const keyPair = await crypto.subtle.generateKey(
    {
      name: "Ed25519",
    },
    true,
    ["sign", "verify"],
  );

  const publicKeyBytes = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privateKeyBytes = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
  const nextKeypair: StoredKeypair = {
    publicKeyB64: bytesToBase64(publicKeyBytes),
    privateKeyPkcs8B64: bytesToBase64(privateKeyBytes),
    keyId: session.issuerKeyId || "key_acme_primary",
  };
  await saveStoredKeypair(nextKeypair);
  updateDocShieldSession({ issuerKeyId: nextKeypair.keyId });
  return nextKeypair;
}

async function importPrivateKey(pkcs8B64: string) {
  return crypto.subtle.importKey(
    "pkcs8",
    base64ToBytes(pkcs8B64),
    { name: "Ed25519" },
    false,
    ["sign"],
  );
}

export async function signCanonicalPayload(payload: unknown) {
  const keypair = await ensureDevSigningIdentity();
  const privateKey = await importPrivateKey(keypair.privateKeyPkcs8B64);
  const signature = await crypto.subtle.sign(
    { name: "Ed25519" },
    privateKey,
    ENCODER.encode(canonicalJsonString(payload)),
  );
  return `ed25519:${bytesToBase64(signature)}`;
}

export async function getDevSigningIdentity() {
  const keypair = await ensureDevSigningIdentity();
  return {
    keyId: keypair.keyId,
    publicKeyB64: keypair.publicKeyB64,
  };
}

export function toBackendIsoString(date: Date = new Date()) {
  return date.toISOString().replace(/\.(\d{3})Z$/, ".$1000Z");
}

from __future__ import annotations

import hashlib
import os
import re
import tempfile
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.services.errors import DocShieldError, NotFoundError


DEFAULT_STORAGE_DIR = Path(__file__).resolve().parents[2] / ".secure_blobs"
DEFAULT_SECRET = "docshield-local-development-only"
NONCE_BYTES = 12
_SAFE_STORAGE_KEY = re.compile(r"^[A-Za-z0-9._-]+$")


def _storage_dir() -> Path:
    configured = os.getenv("DOCSHIELD_BLOB_STORAGE_DIR")
    storage_dir = Path(configured) if configured else DEFAULT_STORAGE_DIR
    storage_dir.mkdir(parents=True, exist_ok=True)
    try:
        storage_dir.chmod(0o700)
    except OSError:
        pass
    return storage_dir


def _encryption_key() -> bytes:
    secret = os.getenv("DOCSHIELD_BLOB_ENCRYPTION_SECRET", DEFAULT_SECRET)
    return hashlib.sha256(secret.encode("utf-8")).digest()


def _validate_storage_key(storage_key: str) -> None:
    if not storage_key or not _SAFE_STORAGE_KEY.fullmatch(storage_key):
        raise DocShieldError("Invalid storage key", status_code=400)


def _blob_path(storage_key: str) -> Path:
    _validate_storage_key(storage_key)
    return _storage_dir() / storage_key


def store_encrypted_blob(storage_key: str, content: bytes) -> None:
    path = _blob_path(storage_key)
    nonce = os.urandom(NONCE_BYTES)
    encrypted = AESGCM(_encryption_key()).encrypt(nonce, content, storage_key.encode("utf-8"))
    payload = nonce + encrypted

    with tempfile.NamedTemporaryFile("wb", delete=False, dir=path.parent) as handle:
        temp_path = Path(handle.name)
        handle.write(payload)

    try:
        os.chmod(temp_path, 0o600)
    except OSError:
        pass
    os.replace(temp_path, path)


def load_encrypted_blob(storage_key: str) -> bytes:
    path = _blob_path(storage_key)
    if not path.exists():
        raise NotFoundError("Shared document is unavailable")

    payload = path.read_bytes()
    if len(payload) <= NONCE_BYTES:
        raise DocShieldError("Stored blob is malformed", status_code=400)

    nonce, ciphertext = payload[:NONCE_BYTES], payload[NONCE_BYTES:]
    try:
        return AESGCM(_encryption_key()).decrypt(nonce, ciphertext, storage_key.encode("utf-8"))
    except Exception as exc:  # pragma: no cover - narrowed by cryptography internals
        raise DocShieldError("Stored blob is malformed or has been altered", status_code=400) from exc


def delete_encrypted_blob(storage_key: str) -> None:
    path = _blob_path(storage_key)
    try:
        path.unlink()
    except FileNotFoundError:
        return


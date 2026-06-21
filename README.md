# njx
Summer NJx Hackathon Proj

## Run locally

From the project root, start both the backend and frontend with:

```sh
npm run dev
```

That launches the FastAPI backend on `127.0.0.1:8000` and the Vite frontend on `localhost:8080`.

## Verify a document

1. Complete organization setup so DocShield registers your Ed25519 public key.
2. Open **Documents**, select a file, and register it. Its SHA-256 fingerprint is calculated automatically.
3. Open **Verify**, select the file, and click **Upload and verify**.

The verifier hashes the uploaded bytes without storing them, finds the signed registry record, and validates the
fingerprint, issuer key status, Ed25519 manifest signature, and signed history chain. Modified or unregistered files
return an unverified result.

import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  createShareLink: vi.fn(),
  downloadSharedDocument: vi.fn(),
}));

const sessionMocks = vi.hoisted(() => ({
  updateDocShieldSession: vi.fn(),
}));

vi.mock("@/lib/docshield-session", () => ({
  getDocShieldSession: () => ({
    tenantId: "tenant_acme",
    tenantName: "Acme Pharma",
    adminEmails: ["admin@acme.com"],
    domains: ["acme.com"],
    issuerKeyId: "key_acme_primary",
    activeDocument: {
      documentId: "doc_public",
      contentFingerprint: "sha256:feedface",
      manifestHash: "sha256:manifest",
      historyTip: "sha256:history",
      signedManifest: {
        manifest: {
          tenant_id: "tenant_acme",
          document_id: "doc_public",
          issuer_key_id: "key_acme_primary",
          content_fingerprint: "sha256:feedface",
          policy: {
            external_ai_upload: "blocked",
            secure_link_required: true,
            forwarding: "blocked",
            public_sharing: "allowed",
          },
          embedded_ai_tags: ["NO_EXTERNAL_AI"],
          created_at: "2026-06-20T12:00:00.000Z",
        },
        manifest_signature: "ed25519:manifest",
        signature_algorithm: "Ed25519",
      },
      history: [],
      sourceFileName: "agreement.pdf",
      sourceFileType: "application/pdf",
      sourceFileSize: 4096,
      accessAnyoneWithLink: true,
      accessMethod: null,
      accessPasswordHash: null,
      shareLink: null,
    },
  }),
  updateDocShieldSession: sessionMocks.updateDocShieldSession,
}));

vi.mock("@/lib/docshield-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/docshield-api")>("@/lib/docshield-api");
  return {
    ...actual,
    api: {
      ...actual.api,
      createShareLink: apiMocks.createShareLink,
      downloadSharedDocument: apiMocks.downloadSharedDocument,
    },
  };
});

vi.mock("@/lib/download", () => ({
  triggerBrowserDownload: vi.fn(),
}));

import DocumentDownloadPage from "./DocumentDownloadPage";

describe("DocumentDownloadPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.createShareLink.mockResolvedValue({
      link_id: "lnk_public",
      document_id: "doc_public",
      token: "token-public",
      access_method: "link",
      expires_at: null,
    });
    apiMocks.downloadSharedDocument.mockResolvedValue(new Blob(["hello"], { type: "application/pdf" }));
  });

  it("creates a share link when the session only has the signed document and then downloads it", async () => {
    render(
      <MemoryRouter initialEntries={["/app/documents/doc_public/download"]}>
        <Routes>
          <Route path="/app/documents/:id/download" element={<DocumentDownloadPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(apiMocks.createShareLink).toHaveBeenCalledWith("doc_public", {
      access_method: "link",
      password_hash: null,
      expires_in_hours: 168,
    }));

    await waitFor(() => expect(apiMocks.downloadSharedDocument).toHaveBeenCalledWith("token-public", {}));
    await waitFor(() => expect(screen.getByText("Download started")).toBeInTheDocument());

    expect(sessionMocks.updateDocShieldSession).toHaveBeenCalledWith(
      expect.objectContaining({
        activeDocument: expect.objectContaining({
          documentId: "doc_public",
          shareLink: expect.objectContaining({
            token: "token-public",
            linkId: "lnk_public",
          }),
        }),
      }),
    );
  });
});

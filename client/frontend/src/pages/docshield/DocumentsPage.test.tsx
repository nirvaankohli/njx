import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  setup: vi.fn(),
  registerDocument: vi.fn(),
  uploadDocumentContent: vi.fn(),
}));

const sessionUpdateMock = vi.hoisted(() => ({
  updateDocShieldSession: vi.fn(),
}));

const signingMocks = vi.hoisted(() => ({
  getDevSigningIdentity: vi.fn(),
  signCanonicalPayload: vi.fn(),
  sha256Hex: vi.fn(),
  toBackendIsoString: vi.fn(),
}));

const fileMocks = vi.hoisted(() => ({
  buildDocumentId: vi.fn(),
  fingerprintDocumentFile: vi.fn(),
  inferDocumentMimeType: vi.fn(),
  isSupportedDocumentFile: vi.fn(),
}));

vi.mock("@/lib/docshield-session", () => ({
  getDocShieldSession: () => ({
    tenantId: "tenant_acme",
    tenantName: "Acme Pharma",
    adminEmails: ["admin@acme.com"],
    domains: ["acme.com"],
    issuerKeyId: "key_acme_primary",
    activeDocument: null,
  }),
  updateDocShieldSession: sessionUpdateMock.updateDocShieldSession,
}));

vi.mock("@/lib/docshield-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/docshield-api")>("@/lib/docshield-api");
  return {
    ...actual,
    api: {
      ...actual.api,
      setup: apiMocks.setup,
      registerDocument: apiMocks.registerDocument,
      uploadDocumentContent: apiMocks.uploadDocumentContent,
    },
  };
});

vi.mock("@/lib/docshield-signing", async () => {
  const actual = await vi.importActual<typeof import("@/lib/docshield-signing")>("@/lib/docshield-signing");
  return {
    ...actual,
    getDevSigningIdentity: signingMocks.getDevSigningIdentity,
    signCanonicalPayload: signingMocks.signCanonicalPayload,
    sha256Hex: signingMocks.sha256Hex,
    toBackendIsoString: signingMocks.toBackendIsoString,
  };
});

vi.mock("@/lib/docshield-file", async () => {
  const actual = await vi.importActual<typeof import("@/lib/docshield-file")>("@/lib/docshield-file");
  return {
    ...actual,
    buildDocumentId: fileMocks.buildDocumentId,
    fingerprintDocumentFile: fileMocks.fingerprintDocumentFile,
    inferDocumentMimeType: fileMocks.inferDocumentMimeType,
    isSupportedDocumentFile: fileMocks.isSupportedDocumentFile,
  };
});

import DocumentsPage from "./DocumentsPage";

describe("DocumentsPage", () => {
  it("keeps the signed document in the local session when backend setup fails", async () => {
    const file = new File(["hello world"], "agreement.pdf", { type: "application/pdf" });

    apiMocks.setup.mockRejectedValueOnce(new Error("Internal Server Error"));
    apiMocks.registerDocument.mockResolvedValueOnce({
      document_id: "doc_agreement_abc123",
      manifest_hash: "sha256:manifest",
      status: "registered",
      history_tip: "sha256:history",
    });
    apiMocks.uploadDocumentContent.mockResolvedValueOnce(undefined);

    signingMocks.getDevSigningIdentity.mockResolvedValueOnce({
      keyId: "key_acme_primary",
      publicKeyB64: "public-key-b64",
    });
    signingMocks.signCanonicalPayload.mockResolvedValue("ed25519:sig");
    signingMocks.sha256Hex.mockImplementation(async (value: string) => {
      if (value.includes("agreement.pdf")) {
        return "sha256:history";
      }
      return "sha256:manifest";
    });
    signingMocks.toBackendIsoString.mockReturnValue("2026-06-20T12:00:00.000Z");

    fileMocks.buildDocumentId.mockReturnValue("doc_agreement_abc123");
    fileMocks.fingerprintDocumentFile.mockResolvedValue("sha256:file-fingerprint");
    fileMocks.inferDocumentMimeType.mockReturnValue("application/pdf");
    fileMocks.isSupportedDocumentFile.mockReturnValue(true);

    const { container } = render(
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>,
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(screen.getByRole("button", { name: "Sign file" }));

    await waitFor(() => {
      expect(screen.getByText("Signed file ready")).toBeInTheDocument();
      expect(screen.getAllByText("agreement.pdf")).toHaveLength(2);
    });

    expect(apiMocks.setup).toHaveBeenCalledTimes(1);
    expect(sessionUpdateMock.updateDocShieldSession).toHaveBeenCalledWith(
      expect.objectContaining({
        activeDocument: expect.objectContaining({
          documentId: "doc_agreement_abc123",
          manifestHash: "sha256:manifest",
          historyTip: "sha256:history",
        }),
      }),
    );
  });
});

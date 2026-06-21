import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  sharedDocument: vi.fn(),
  downloadSharedDocument: vi.fn(),
}));

const signingMocks = vi.hoisted(() => ({
  sha256Hex: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

let clickSpy: ReturnType<typeof vi.spyOn> | null = null;

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => routerMocks.navigate,
  };
});

vi.mock("@/lib/docshield-session", () => ({
  getDocShieldSession: () => ({
    tenantId: "tenant_acme",
    tenantName: "Acme Pharma",
    adminEmails: ["admin@acme.com"],
    domains: ["acme.com"],
    issuerKeyId: "key_acme_primary",
    activeDocument: null,
  }),
}));

vi.mock("@/lib/docshield-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/docshield-api")>("@/lib/docshield-api");
  return {
    ...actual,
    api: {
      ...actual.api,
      sharedDocument: apiMocks.sharedDocument,
      downloadSharedDocument: apiMocks.downloadSharedDocument,
    },
  };
});

vi.mock("@/lib/docshield-signing", async () => {
  const actual = await vi.importActual<typeof import("@/lib/docshield-signing")>("@/lib/docshield-signing");
  return {
    ...actual,
    sha256Hex: signingMocks.sha256Hex,
  };
});

import SharedDocumentPage from "./SharedDocumentPage";

describe("SharedDocumentPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const createObjectUrlSpy = vi.fn().mockReturnValue("blob:shared");
    const revokeObjectUrlSpy = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { value: createObjectUrlSpy, configurable: true });
    Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectUrlSpy, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("auto-downloads public links and shows a confirmation screen", async () => {
    apiMocks.sharedDocument.mockResolvedValueOnce({
      link_id: "lnk_public",
      document_id: "doc_public_123",
      tenant_id: "tenant_acme",
      file_name: "agreement.pdf",
      content_type: "application/pdf",
      size_bytes: 4096,
      content_fingerprint: "sha256:feedface",
      issuer_key_id: "key_acme_primary",
      access_method: "link",
      password_required: false,
      expires_at: null,
    });
    apiMocks.downloadSharedDocument.mockResolvedValueOnce(new Blob(["hello"], { type: "application/pdf" }));

    render(
      <MemoryRouter initialEntries={["/s/token-public"]}>
        <Routes>
          <Route path="/s/:token" element={<SharedDocumentPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("Download started")).toBeInTheDocument());
    expect(apiMocks.downloadSharedDocument).toHaveBeenCalledWith("token-public", {});
    expect(clickSpy).toHaveBeenCalled();
  });

  it("sends organization links to auth before downloading", async () => {
    apiMocks.sharedDocument.mockResolvedValueOnce({
      link_id: "lnk_org",
      document_id: "doc_org_123",
      tenant_id: "tenant_acme",
      file_name: "agreement.pdf",
      content_type: "application/pdf",
      size_bytes: 4096,
      content_fingerprint: "sha256:feedface",
      issuer_key_id: "key_acme_primary",
      access_method: "organization",
      password_required: false,
      expires_at: null,
    });

    render(
      <MemoryRouter initialEntries={["/s/token-org"]}>
        <Routes>
          <Route path="/s/:token" element={<SharedDocumentPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(routerMocks.navigate).toHaveBeenCalledWith("/auth", {
        replace: true,
        state: { from: "/s/token-org" },
      }),
    );
    expect(apiMocks.downloadSharedDocument).not.toHaveBeenCalled();
  });

  it("unlocks password-protected links before starting the download", async () => {
    signingMocks.sha256Hex.mockResolvedValueOnce("sha256:password");
    apiMocks.sharedDocument.mockResolvedValueOnce({
      link_id: "lnk_password",
      document_id: "doc_password_123",
      tenant_id: "tenant_acme",
      file_name: "contract.pdf",
      content_type: "application/pdf",
      size_bytes: 2048,
      content_fingerprint: "sha256:c0ffee",
      issuer_key_id: "key_acme_primary",
      access_method: "password",
      password_required: true,
      expires_at: null,
    });
    apiMocks.downloadSharedDocument.mockResolvedValueOnce(new Blob(["hello"], { type: "application/pdf" }));

    render(
      <MemoryRouter initialEntries={["/s/token-password"]}>
        <Routes>
          <Route path="/s/:token" element={<SharedDocumentPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByLabelText("Access password")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Access password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Unlock and download" }));

    await waitFor(() => expect(screen.getByText("Download started")).toBeInTheDocument());
    expect(signingMocks.sha256Hex).toHaveBeenCalledWith("password");
    expect(apiMocks.downloadSharedDocument).toHaveBeenCalledWith("token-password", {
      passwordHash: "sha256:password",
    });
    expect(clickSpy).toHaveBeenCalled();
  });
});

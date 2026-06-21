import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  document: vi.fn(),
  shareAnalytics: vi.fn(),
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
  updateDocShieldSession: vi.fn(),
}));

vi.mock("@/lib/docshield-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/docshield-api")>("@/lib/docshield-api");
  return { ...actual, api: { ...actual.api, ...apiMocks } };
});

import DocumentDetailPage from "./DocumentDetailPage";

describe("DocumentDetailPage", () => {
  it("loads a managed document and its signing history from the backend", async () => {
    apiMocks.document.mockResolvedValueOnce({
      document_id: "doc_report",
      tenant_id: "tenant_acme",
      issuer_key_id: "key_acme_primary",
      content_fingerprint: "sha256:report",
      policy: {
        external_ai_upload: "blocked",
        secure_link_required: true,
        forwarding: "blocked",
        public_sharing: "blocked",
      },
      embedded_ai_tags: ["NO_EXTERNAL_AI"],
      created_at: "2026-06-20T12:00:00.000Z",
      status: "active",
      file_name: "report.pdf",
      content_type: "application/pdf",
      size_bytes: 2048,
      access_method: "organization",
      event_count: 1,
      manifest: {},
      manifest_hash: "sha256:manifest",
      history_tip: "sha256:history",
      history: [{
        event_id: "evt_issued",
        document_id: "doc_report",
        event: "issued",
        actor_org: "Acme Pharma",
        actor_key_id: "key_acme_primary",
        timestamp: "2026-06-20T12:00:00.000Z",
        previous_event_hash: null,
        manifest_hash: "sha256:manifest",
        payload: {},
        signature: "ed25519:signature",
      }],
      last_verified_status: null,
      last_verified_at: null,
    });

    render(
      <MemoryRouter initialEntries={["/app/documents/doc_report"]}>
        <Routes>
          <Route path="/app/documents/:id" element={<DocumentDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("report.pdf")).toBeInTheDocument();
    expect(screen.getByText("sha256:report")).toBeInTheDocument();
    expect(screen.getByText("Acme Pharma")).toBeInTheDocument();
    expect(screen.getByText("sig=ed25519:signature")).toBeInTheDocument();
    expect(apiMocks.document).toHaveBeenCalledWith("doc_report", "tenant_acme");
  });
});

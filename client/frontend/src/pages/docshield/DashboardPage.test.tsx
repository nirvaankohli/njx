import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  dashboard: vi.fn(),
  documents: vi.fn(),
}));

vi.mock("@/lib/docshield-session", () => ({
  getDocShieldSession: () => ({
    tenantId: "tenant_acme",
    tenantName: "Acme Pharma",
    adminEmails: ["admin@acme.com"],
    domains: ["acme.com"],
    issuerKeyId: "key_acme_primary",
    activeDocument: { documentId: "stale_active_document" },
  }),
}));

vi.mock("@/lib/docshield-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/docshield-api")>("@/lib/docshield-api");
  return { ...actual, api: { ...actual.api, ...apiMocks } };
});

import DashboardPage from "./DashboardPage";

describe("DashboardPage", () => {
  it("loads tenant-wide totals and resolves activity to real document names", async () => {
    apiMocks.dashboard.mockResolvedValueOnce({
      tenant_id: "tenant_acme",
      documents: 2,
      access_events: 4,
      alerts: [{ document_id: "doc_report", severity: "high", reason_codes: ["rapid_downloads"], score: 80 }],
      recent_activity: [{
        document_id: "doc_report",
        timestamp: "2026-06-20T12:00:00.000Z",
        action: "download",
        country: "US",
      }],
    });
    apiMocks.documents.mockResolvedValueOnce([{
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
      file_name: "quarterly-report.pdf",
      content_type: "application/pdf",
      size_bytes: 2048,
      access_method: "organization",
      event_count: 1,
    }]);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("link", { name: /quarterly-report\.pdf/ })).toBeInTheDocument();
    expect(screen.getByText("Global download heatmap")).toBeInTheDocument();
    expect(screen.getAllByText("quarterly-report.pdf")).toHaveLength(3);
    expect(screen.getByText("2", { selector: "h3" })).toBeInTheDocument();
    expect(apiMocks.dashboard).toHaveBeenCalledWith("tenant_acme");
    expect(apiMocks.documents).toHaveBeenCalledWith("tenant_acme");
  });
});

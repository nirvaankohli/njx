import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/docshield-session", () => ({
  getDocShieldSession: () => ({
    tenantId: "tenant_acme",
    activeDocument: null,
  }),
}));

const mocks = vi.hoisted(() => ({
  accessEventsFeed: vi.fn(),
  logAccessEvent: vi.fn(),
}));

vi.mock("@/lib/docshield-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/docshield-api")>("@/lib/docshield-api");
  return {
    ...actual,
    api: {
      ...actual.api,
      accessEventsFeed: mocks.accessEventsFeed,
      logAccessEvent: mocks.logAccessEvent,
    },
  };
});

import AccessEventsPage from "./AccessEventsPage";

describe("AccessEventsPage", () => {
  it("highlights suspicious events in red and keeps normal events neutral", async () => {
    mocks.accessEventsFeed.mockResolvedValueOnce({
      tenant_id: "tenant_acme",
      total_events: 2,
      suspicious_events: 1,
      events: [
        {
          event_id: "ae_red",
          tenant_id: "tenant_acme",
          document_id: "doc_red",
          link_id: "lnk_red",
          timestamp: "2026-06-20T20:09:00Z",
          action: "download",
          ip_hash: "sha256:ip-red",
          user_agent_hash: "sha256:ua-red",
          country: "RU",
          result: "failed",
          reason: "burst_access",
          risk_score: 91,
          risk_reasons: ["blocked_attempts", "new_geography"],
          severity: "high",
          suspicious: true,
        },
        {
          event_id: "ae_ok",
          tenant_id: "tenant_acme",
          document_id: "doc_ok",
          link_id: "lnk_ok",
          timestamp: "2026-06-20T20:08:00Z",
          action: "open",
          ip_hash: "sha256:ip-ok",
          user_agent_hash: "sha256:ua-ok",
          country: "US",
          result: "allowed",
          reason: null,
          risk_score: 12,
          risk_reasons: [],
          severity: "low",
          suspicious: false,
        },
      ],
    });

    render(<AccessEventsPage />);

    await waitFor(() => expect(screen.getByText("Recent events")).toBeInTheDocument());

    const suspiciousRow = screen.getAllByText("doc_red")[0].closest("button");
    const normalRow = screen.getAllByText("doc_ok")[0].closest("button");

    expect(suspiciousRow).not.toBeNull();
    expect(normalRow).not.toBeNull();

    fireEvent.click(normalRow as HTMLButtonElement);

    await waitFor(() => {
      expect(suspiciousRow?.className).toContain("bg-red-500/8");
      expect(suspiciousRow?.className).toContain("border-red-500/25");
      expect(normalRow?.className).not.toContain("bg-red-500/8");
      expect(normalRow?.className).not.toContain("border-red-500/25");
      expect(normalRow?.className).toContain("border-ring");
    });
  });
});

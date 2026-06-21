import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  setup: vi.fn(),
}));

const sessionUpdateMock = vi.hoisted(() => ({
  updateDocShieldSession: vi.fn(),
}));

const signingMocks = vi.hoisted(() => ({
  ensureDevSigningIdentity: vi.fn(),
}));

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/docshield-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/docshield-api")>("@/lib/docshield-api");
  return {
    ...actual,
    api: {
      ...actual.api,
      setup: apiMocks.setup,
    },
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
  updateDocShieldSession: sessionUpdateMock.updateDocShieldSession,
}));

vi.mock("@/lib/docshield-signing", () => ({
  ensureDevSigningIdentity: signingMocks.ensureDevSigningIdentity,
}));

vi.mock("sonner", () => ({
  toast: toastMocks,
}));

import SetupPage from "./SetupPage";

describe("SetupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits guided settings without exposing the JSON editor", async () => {
    signingMocks.ensureDevSigningIdentity.mockResolvedValueOnce({
      keyId: "key_ready",
      publicKeyB64: "public-key-b64",
    });
    apiMocks.setup.mockResolvedValueOnce({
      tenant_id: "tenant_acme",
      status: "active",
      registered_policy_templates: 1,
      registered_public_keys: 1,
    });

    render(
      <MemoryRouter>
        <SetupPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("key_ready")).toBeInTheDocument();
    });

    expect(screen.queryByLabelText(/Policy templates JSON/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Add domain"), { target: { value: "acme.io" } });
    fireEvent.click(screen.getByRole("button", { name: "Add domain" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove acme.com" }));

    fireEvent.change(screen.getByLabelText("Add employee email"), { target: { value: "ops@acme.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Add email" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove admin@acme.com" }));

    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    fireEvent.click(screen.getByRole("button", { name: "Add template" }));
    const policyIds = screen.getAllByLabelText("Policy ID");
    const policyNames = screen.getAllByLabelText("Name");
    fireEvent.change(policyIds[1], { target: { value: "public_share_policy" } });
    fireEvent.change(policyNames[1], { target: { value: "Public Share" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[1]);

    fireEvent.click(screen.getByRole("button", { name: "Save organization" }));

    await waitFor(() => {
      expect(apiMocks.setup).toHaveBeenCalledTimes(1);
    });

    expect(apiMocks.setup).toHaveBeenCalledWith({
      tenant: {
        tenant_id: "tenant_acme",
        org_name: "Acme Pharma",
        domains: ["acme.io"],
        admin_emails: ["ops@acme.com"],
        status: "active",
      },
      policy_templates: [
        {
          policy_id: "no_external_ai",
          name: "No external AI",
          policy: {
            external_ai_upload: "allowed",
            secure_link_required: false,
            forwarding: "allowed",
            public_sharing: "allowed",
          },
        },
      ],
      public_keys: [
        {
          key_id: "key_ready",
          algorithm: "Ed25519",
          public_key_b64: "public-key-b64",
          status: "active",
        },
      ],
    });

    expect(sessionUpdateMock.updateDocShieldSession).toHaveBeenCalledWith({
      tenantId: "tenant_acme",
      tenantName: "Acme Pharma",
      adminEmails: ["ops@acme.com"],
      domains: ["acme.io"],
      issuerKeyId: "key_ready",
    });
    expect(toastMocks.success).toHaveBeenCalledWith("Tenant configured", expect.any(Object));
  });

  it("blocks duplicate policy ids before submitting", async () => {
    signingMocks.ensureDevSigningIdentity.mockResolvedValueOnce({
      keyId: "key_ready",
      publicKeyB64: "public-key-b64",
    });

    render(
      <MemoryRouter>
        <SetupPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("key_ready")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Add template" }));
    const policyIds = screen.getAllByLabelText("Policy ID");
    fireEvent.change(policyIds[1], { target: { value: "no_external_ai" } });
    fireEvent.click(screen.getByRole("button", { name: "Save organization" }));

    await waitFor(() => {
      expect(toastMocks.error).toHaveBeenCalledWith("Duplicate policy IDs are not allowed");
    });

    expect(apiMocks.setup).not.toHaveBeenCalled();
  });
});

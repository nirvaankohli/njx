import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  companySettings: vi.fn(),
  signOut: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user_1", email: "owner@example.com" },
    signOut: mocks.signOut,
  }),
}));

vi.mock("@/lib/frontend-api", () => ({
  frontendApi: { companySettings: mocks.companySettings },
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess },
}));

import SettingsPage from "./SettingsPage";

describe("SettingsPage", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => storage.clear(),
        getItem: (key: string) => storage.get(key) ?? null,
        removeItem: (key: string) => storage.delete(key),
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    vi.clearAllMocks();
    mocks.companySettings.mockResolvedValue({
      user_id: "user_1",
      company_name: "Acme Labs",
      company_website: "acme.example",
      industry: "Research",
    });
  });

  it("opens mock pricing and persists a Tier 2 selection", async () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Acme Labs")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Explore pricing" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose Tier 2" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    expect(window.localStorage.getItem("docshield.mock-plan")).toBe("tier-2");
    expect(screen.getByText("Tier 2", { selector: "div" })).toBeInTheDocument();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Tier 2 selected", expect.any(Object));
  });

  it("offers a retry when organization loading fails", async () => {
    mocks.companySettings.mockRejectedValueOnce(new Error("Service unavailable"));

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Service unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(await screen.findByText("Acme Labs")).toBeInTheDocument();
    expect(mocks.companySettings).toHaveBeenCalledTimes(2);
  });
});

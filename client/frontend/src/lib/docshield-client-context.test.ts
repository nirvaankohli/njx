import { afterEach, describe, expect, it, vi } from "vitest";
import { resetClientContextForTests, resolveClientContext } from "./docshield-client-context";

describe("resolveClientContext", () => {
  afterEach(() => {
    resetClientContextForTests();
    vi.restoreAllMocks();
  });

  it("normalizes and caches public IP context", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ip: "8.8.8.8", country_code: "us" }), { status: 200 }),
    );

    await expect(resolveClientContext()).resolves.toEqual({ ipAddress: "8.8.8.8", country: "US" });
    await resolveClientContext();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fails open when lookup is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    await expect(resolveClientContext()).resolves.toEqual({});
  });

  it("retries after a transient lookup failure", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ip: "8.8.8.8", country_code: "ca" }), { status: 200 }),
      );

    await expect(resolveClientContext()).resolves.toEqual({});
    await expect(resolveClientContext()).resolves.toEqual({ ipAddress: "8.8.8.8", country: "CA" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

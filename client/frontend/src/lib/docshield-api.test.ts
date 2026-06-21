import { afterEach, describe, expect, it, vi } from "vitest";
import { api, buildUrl } from "./docshield-api";
import { resetClientContextForTests } from "./docshield-client-context";

describe("docshield api module", () => {
  afterEach(() => {
    resetClientContextForTests();
    vi.restoreAllMocks();
  });

  it("imports cleanly and exposes the expected helpers", () => {
    expect(api.baseUrl).toBeTypeOf("string");
    expect(buildUrl("/health")).toContain("/health");
  });

  it("retries client context lookup so downloads can still include country headers", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(new Response("first", { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ip: "8.8.8.8", country_code: "ca" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response("second", { status: 200 }));

    await api.downloadSharedDocument("token-public");
    await api.downloadSharedDocument("token-public");

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const secondDownloadInit = fetchMock.mock.calls[3]?.[1];
    expect(secondDownloadInit?.headers).toMatchObject({ "X-Client-Country": "CA" });
  });
});

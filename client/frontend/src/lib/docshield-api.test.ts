import { describe, expect, it } from "vitest";
import { api, buildUrl } from "./docshield-api";

describe("docshield api module", () => {
  it("imports cleanly and exposes the expected helpers", () => {
    expect(api.baseUrl).toBeTypeOf("string");
    expect(buildUrl("/health")).toContain("/health");
  });
});

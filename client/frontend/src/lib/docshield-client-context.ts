export type ClientContext = {
  ipAddress?: string;
  country?: string;
};

let cachedContext: ClientContext | null = null;
let cachedLookup: Promise<ClientContext> | null = null;

export function resolveClientContext(): Promise<ClientContext> {
  if (cachedContext) return Promise.resolve(cachedContext);
  if (cachedLookup) return cachedLookup;

  cachedLookup = (async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch("https://get.geojs.io/v1/ip/geo.json", {
        signal: controller.signal,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      if (!response.ok) return {};
      const payload = (await response.json()) as { ip?: unknown; country_code?: unknown };
      const ipAddress = typeof payload.ip === "string" ? payload.ip.trim() : undefined;
      const countryValue = typeof payload.country_code === "string" ? payload.country_code.trim().toUpperCase() : "";
      return {
        ...(ipAddress ? { ipAddress } : {}),
        ...(/^[A-Z]{2}$/.test(countryValue) ? { country: countryValue } : {}),
      };
    } catch {
      cachedLookup = null;
      return {};
    } finally {
      window.clearTimeout(timeout);
    }
  })().then((context) => {
    if (Object.keys(context).length > 0) {
      cachedContext = context;
    } else {
      cachedLookup = null;
    }
    return context;
  });
  return cachedLookup;
}

export function resetClientContextForTests() {
  cachedContext = null;
  cachedLookup = null;
}

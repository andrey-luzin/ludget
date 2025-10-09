export type Rates = Record<string, number>;

// Fetches rates where 1 base = rates[QUOTE] units of QUOTE.
export async function fetchRates(base: string, neededCodes?: string[]): Promise<Rates> {
  const baseUrl = process.env.NEXT_PUBLIC_EXCHANGE_API_BASE || "https://api.exchangerate.host/live";
  const apiKey = process.env.NEXT_PUBLIC_EXCHANGE_API_KEY;
  const params = new URLSearchParams({ format: '1' });
  if (apiKey) params.set("access_key", apiKey);
  const isLive = baseUrl.includes('/live');
  if (isLive) {
    params.set('source', String(base).toUpperCase());
    if (neededCodes && neededCodes.length) params.set('currencies', neededCodes.join(','));
  } else {
    params.set('base', String(base).toUpperCase());
    if (neededCodes && neededCodes.length) params.set('symbols', neededCodes.join(','));
  }
  const url = `${baseUrl.replace(/\/$/, "")}?${params.toString()}`;
  let json: any = null;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e: any) {
    throw new Error(`Network error while fetching rates: ${e?.message || String(e)}`);
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch rates: HTTP ${res.status} ${res.statusText || ""}`.trim());
  }
  try {
    json = await res.json();
  } catch {
    throw new Error("Failed to parse exchange rates response");
  }
  // Handle providers that return 200 with success=false
  if (json && typeof json === "object" && "success" in json && json.success === false) {
    const msg = json?.error?.info || json?.error?.type || "Exchange API returned an error";
    throw new Error(msg);
  }
  // Support two formats:
  // 1) { rates: { EUR: 0.9, RUB: 90 }, base: "USD" }
  // 2) { source: "USD", quotes: { USDEUR: 0.9, USDRUB: 90 } }
  if (json?.rates && typeof json.rates === "object") {
    return json.rates as Rates;
  }
  if (json?.quotes && typeof json.quotes === "object" && typeof json?.source === "string") {
    const source: string = String(json.source).toUpperCase();
    const out: Rates = {};
    for (const [k, v] of Object.entries(json.quotes as Record<string, number>)) {
      if (typeof v !== 'number') continue;
      const key = String(k).toUpperCase();
      if (key.startsWith(source)) {
        const quote = key.slice(source.length);
        out[quote] = v;
      }
    }
    return out;
  }
  throw new Error("Malformed exchange rates response");
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const LS_PREFIX = "ludget:fx";

type CachePayload = {
  updatedAt: number;
  rates: Rates;
};

export async function getRatesWithCache(base: string, opts?: { force?: boolean; neededCodes?: string[] }): Promise<{ rates: Rates; updatedAt: number; fromCache: boolean; error?: string }>{
  // SSR or no window: just fetch live
  if (typeof window === "undefined") {
    const live = await fetchRates(base, opts?.neededCodes);
    return { rates: live, updatedAt: Date.now(), fromCache: false };
  }
  const key = `${LS_PREFIX}:${base.toUpperCase()}`;
  let cached: CachePayload | null = null;
  try {
    const raw = localStorage.getItem(key);
    if (raw) cached = JSON.parse(raw) as CachePayload;
  } catch {}

  const now = Date.now();
  if (!opts?.force && cached && now - cached.updatedAt < ONE_DAY_MS) {
    const filtered = filterRates(cached.rates, opts?.neededCodes);
    return { rates: filtered, updatedAt: cached.updatedAt, fromCache: true };
  }

  try {
    const live = await fetchRates(base, opts?.neededCodes);
    const payload: CachePayload = { updatedAt: now, rates: live };
    try {
      localStorage.setItem(key, JSON.stringify(payload));
    } catch {}
    const filtered = filterRates(live, opts?.neededCodes);
    return { rates: filtered, updatedAt: now, fromCache: false };
  } catch (e: any) {
    if (cached) {
      const filtered = filterRates(cached.rates, opts?.neededCodes);
      return { rates: filtered, updatedAt: cached.updatedAt, fromCache: true, error: e?.message || String(e) };
    }
    throw e;
  }
}

function filterRates(rates: Rates, needed?: string[]) {
  if (!needed || needed.length === 0) return rates;
  const set = new Set(needed.map((c) => c.toUpperCase()));
  const out: Rates = {};
  for (const [k, v] of Object.entries(rates)) {
    if (set.has(k.toUpperCase())) out[k] = v;
  }
  return out;
}

// Convert from txCurrency to base using rates map where: 1 base = rates[QUOTE] units of QUOTE.
export function convertToBaseFactor(txCurrencyCode: string, rates: Record<string, number>, baseCode: string) {
  if (!txCurrencyCode || !rates) return 1;
  if (txCurrencyCode.toUpperCase() === baseCode.toUpperCase()) return 1;
  const r = rates[txCurrencyCode] ?? rates[txCurrencyCode.toUpperCase()];
  if (!r || r === 0) return 1;
  // rates map is: 1 base = r units of txCurrency
  // So X txCurrency = X / r in base
  return 1 / r;
}

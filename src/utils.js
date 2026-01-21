// Minimal utilities (DE-focused)

export function escHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function stripQuery(u) {
  try {
    const url = new URL(u);
    url.search = "";
    return url.toString();
  } catch {
    return String(u || "");
  }
}

export function normalizeSpace(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

// ---------------- Price parsing (EUR-friendly) ----------------

// Matches things like: "1.299,00 €", "1299€", "€ 12,99", "12.99 EUR"
const PRICE_RE = /(?:€\s*)?\b\d{1,3}(?:[\.,\s]\d{3})*(?:[\.,]\d{2})?\b\s*(?:€|eur)?/gi;

function normalizeDecimal(text) {
  // Convert "1.299,00" -> "1299.00" ; "12,99" -> "12.99"
  const s = String(text || "").trim();
  const hasComma = s.includes(",");
  if (hasComma) {
    // assume comma decimal, dot/space thousand
    const noThousands = s.replace(/[\.\s]/g, "");
    return noThousands.replace(",", ".");
  }
  // dot decimal (or no decimals)
  return s.replace(/\s/g, "");
}

export function normalizePriceText(s) {
  const m = String(s || "").match(PRICE_RE);
  if (!m || !m.length) return "";
  // Keep first match, normalize spaces and trailing currency
  let p = m[0]
    .replace(/EUR/gi, "€")
    .replace(/\s+/g, " ")
    .trim();

  // Ensure it ends with € (nice for DE)
  if (!/€/.test(p)) p = `${p} €`;
  return p;
}

export function priceToNumber(priceText) {
  const s = String(priceText || "");
  const m = s.match(PRICE_RE);
  if (!m || !m.length) return 0;

  // Extract the number part only
  const raw = m[0]
    .replace(/€/g, "")
    .replace(/EUR/gi, "")
    .trim();

  const normalized = normalizeDecimal(raw);
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

export function calcDiscountPct(now, was) {
  const n = priceToNumber(now);
  const w = priceToNumber(was);
  if (!n || !w || w <= n) return undefined;
  return Math.round(((w - n) / w) * 100);
}

export function sanitizePrices({ now, was }) {
  const n = priceToNumber(now);
  const w = priceToNumber(was);

  if (!n && !w) return { now: "", was: "" };
  if (n && !w) return { now: normalizePriceText(now), was: "" };
  if (!n && w) return { now: normalizePriceText(was), was: "" };

  // if now is bigger than was => swapped
  if (n > w) {
    return { now: normalizePriceText(was), was: normalizePriceText(now) };
  }

  return { now: normalizePriceText(now), was: normalizePriceText(was) };
}

export function extractPricesFromText(text) {
  const t = String(text || "");
  const matches = t.match(PRICE_RE) || [];
  const cleaned = matches.map((x) => normalizePriceText(x));
  return {
    now: cleaned[0] || "",
    was: cleaned[1] || "",
  };
}

export function scoreDeal(d) {
  const pct = Number.isFinite(d.discountPct) ? d.discountPct : 0;
  const now = priceToNumber(d.now);
  return pct * 10 + Math.min(now, 2000) / 100;
}

// ---------------- Image helpers (avoid blur) ----------------

export function isLowResImageUrl(u) {
  const s = String(u || "");
  if (!s) return true;
  if (/\bwidth=(?:\d{1,2}|1\d{2})\b/i.test(s)) return true;
  if (/\b(?:w|h)=(?:\d{1,2}|1\d{2})\b/i.test(s)) return true;
  if (/(?:_|-)(?:\d{2}|\d{2,3})x(?:\d{2}|\d{2,3})(?=\.)/i.test(s)) return true;
  if (/\b(?:\d{2}|\d{2,3})x(?:\d{2}|\d{2,3})\.(?:jpg|jpeg|png|webp)\b/i.test(s)) return true;
  return false;
}

export function ensureHighResImageUrl(u, target = 1200) {
  const s = String(u || "");
  if (!s) return "";

  // Shopify-like: ..._32x32.jpg -> ..._1200x1200.jpg
  let out = s.replace(/([_-])(\d{2,3})x(\d{2,3})(?=\.)/i, `$1${target}x${target}`);

  // Some CDNs use .../32x32.jpg
  out = out.replace(/\/(\d{2,3})x(\d{2,3})(?=\.)/i, `/${target}x${target}`);

  // Query-based resizing
  try {
    const url = new URL(out);
    if (url.searchParams.has("width")) url.searchParams.set("width", String(target));
    if (url.searchParams.has("w")) url.searchParams.set("w", String(target));
    if (url.searchParams.has("h")) url.searchParams.set("h", String(target));
    out = url.toString();
  } catch {
    // ignore
  }

  return out;
}

export function getTimeSlotDE() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" })
  );
  const hour = now.getHours();

  if (hour >= 7 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 23) return "night";

  return "off";
}

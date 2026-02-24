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
//
// IMPORTANT:
// We ONLY treat a token as a price if it explicitly includes € or EUR.
// This avoids false hits like "923°" (heat) or '6.59"' (screen size).

// Matches things like: "1.299,00 €", "1299€", "€ 12,99", "12.99 EUR"
const PRICE_TOKEN_RE =
  /(?:€\s*\d{1,3}(?:[\.\s]\d{3})*(?:[.,]\d{1,2})?|\b\d{1,3}(?:[\.\s]\d{3})*(?:[.,]\d{1,2})?\s*(?:€|eur)\b)/gi;

// Matches numeric part only (used after we already know it's a price token)
const NUMBER_RE = /\b\d{1,3}(?:[\.\s]\d{3})*(?:[.,]\d{1,2})?\b/;

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
  const str = String(s || "");
  const m = str.match(NUMBER_RE);
  if (!m || !m.length) return "";

  // Keep only the number part, normalize spaces and enforce trailing €
  const numPart = m[0].trim();
  return `${numPart} €`.replace(/\s+/g, " ").trim();
}

export function priceToNumber(priceText) {
  const str = String(priceText || "");
  const m = str.match(NUMBER_RE);
  if (!m || !m.length) return 0;

  const raw = m[0].trim();
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

  // Only pick tokens that include € / EUR
  const matches = t.match(PRICE_TOKEN_RE) || [];
  const cleaned = matches.map((x) => normalizePriceText(x)).filter(Boolean);

  if (!cleaned.length) return { now: "", was: "" };

  // If there is NO explicit "old price" marker, don't assume 2nd price = was.
  // This prevents variant prices like "383,95€ / 433,95€" becoming Was/Now.
  const hasOldPriceMarker = /(?:statt|uvp|vorher|was|previously|instead of)/i.test(t);

  return {
    now: cleaned[0] || "",
    was: hasOldPriceMarker ? (cleaned[1] || "") : "",
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
  // MyDealz image CDN commonly: .../re/150x150/qt/55/...
  if (/\/re\/(?:\d{2,3})x(?:\d{2,3})\//i.test(s)) return true;
  if (/\bwidth=(?:\d{1,2}|1\d{2})\b/i.test(s)) return true;
  if (/\b(?:w|h)=(?:\d{1,2}|1\d{2})\b/i.test(s)) return true;
  if (/(?:_|-)(?:\d{2}|\d{2,3})x(?:\d{2}|\d{2,3})(?=\.)/i.test(s)) return true;
  if (/\b(?:\d{2}|\d{2,3})x(?:\d{2}|\d{2,3})\.(?:jpg|jpeg|png|webp)\b/i.test(s)) return true;
  return false;
}

export function ensureHighResImageUrl(u, target = 1200) {
  const s = String(u || "");
  if (!s) return "";

  // MyDealz image CDN: .../re/150x150/qt/55/... -> .../re/1200x1200/qt/80/...
  if (/static\.mydealz\.de/i.test(s) && /\/re\/(?:\d{2,3})x(?:\d{2,3})\//i.test(s)) {
    return s
      .replace(/\/re\/(?:\d{2,3})x(?:\d{2,3})\//i, `/re/${target}x${target}/`)
      .replace(/\/qt\/(?:\d{1,2})\//i, `/qt/80/`);
  }

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

  // Exact post times (Berlin local time): 08:00, 12:00, 18:00
  if (hour === 8) return "morning";
  if (hour === 12) return "afternoon";
  if (hour === 18) return "evening";
  return "off";
}

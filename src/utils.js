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

export function normalizePriceText(s) {
  // Robust extraction when multiple prices appear
  const str = String(s || "");
  const count = (str.match(/€|EUR/gi) || []).length;
  if (count >= 2) {
    const { now } = extractPricesFromText(str);
    if (now) return now;
  }

  // Fallback: first € 12,99 / 1.299,00 € / EUR 12,99
  const m =
    str.match(/(?:€\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d{1,3}(?:\.\d{3})*(?:,\d{2})?\s*€|EUR\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/i);
  return m ? m[0].replace(/\s+/g, "") : "";
}


export function priceToNumber(priceText) {
  // Supports: 12,99 € ; 1.299,00€ ; €12,99 ; 12.99 ; 1,299.00
  const raw = String(priceText || "")
    .replace(/[^0-9.,]/g, "")
    .trim();
  if (!raw) return 0;

  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");

  let normalized = raw;

  // If both separators exist, assume the last one is decimal
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      // 1.299,00  -> thousands '.' , decimal ','
      normalized = raw.replace(/\./g, "").replace(/,/g, ".");
    } else {
      // 1,299.00 -> thousands ',' , decimal '.'
      normalized = raw.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    // Only comma: assume decimal comma if it looks like cents
    const parts = raw.split(",");
    if (parts.length === 2 && parts[1].length === 2) {
      normalized = parts[0].replace(/\./g, "") + "." + parts[1];
    } else {
      // otherwise treat comma as thousands separator
      normalized = raw.replace(/,/g, "");
    }
  } else {
    // Only dot or none
    normalized = raw.replace(/,/g, "");
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}


export function calcDiscountPct(now, was) {
  const n = priceToNumber(now);
  const w = priceToNumber(was);
  if (!n || !w || w <= n) return undefined;
  return Math.round(((w - n) / w) * 100);
}

export function safeUrl(u) {
  try {
    const url = new URL(u);
    return url.toString();
  } catch {
    return "";
  }
}

/**
 * Fix common pricing mistakes:
 * - if now/was swapped (now > was), swap them
 * - if one is missing, keep the other
 */
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

/**
 * Score deal for ranking:
 * - discountPct matters most
 * - higher price gives slight boost for "high ticket preference"
 */
export function scoreDeal(d) {
  const pct = Number.isFinite(d.discountPct) ? d.discountPct : 0;
  const now = priceToNumber(d.now);
  return pct * 10 + Math.min(now, 2000) / 100;
}

// ---------------- Image helpers (avoid blur) ----------------

// Common thumbnail patterns: _32x32, -32x32, 32x32.jpg, ?width=32, etc.
export function isLowResImageUrl(u) {
  const s = String(u || "");
  if (!s) return true;
  if (/\bwidth=(?:\d{1,2}|1\d{2})\b/i.test(s)) return true;
  if (/\b(?:w|h)=(?:\d{1,2}|1\d{2})\b/i.test(s)) return true;
  if (/(?:_|-)(?:\d{2}|\d{2,3})x(?:\d{2}|\d{2,3})(?=\.)/i.test(s)) return true;
  if (/\b(?:\d{2}|\d{2,3})x(?:\d{2}|\d{2,3})\.(?:jpg|jpeg|png|webp)\b/i.test(s)) return true;
  return false;
}

// Try to upgrade known CDN thumbnail URLs to a larger size.
export function ensureHighResImageUrl(u, target = 1200) {
  const s = String(u || "");
  if (!s) return "";

  // Shopify CDN: ..._32x32.jpg -> ..._1200x1200.jpg
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

// ---------------- Price parsing helpers (fallback) ----------------

export function extractPricesFromText(text) {
  const t = String(text || "");

  // Capture EUR-like prices with indices.
  // Examples: 12,99 € | 1.299,00€ | €12,99 | EUR 12,99
  const re =
    /(?:€\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d{1,3}(?:\.\d{3})*(?:,\d{2})?\s*€|EUR\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/gi;

  const candidates = [];
  for (const m of t.matchAll(re)) {
    const raw = String(m[0] || "");
    const idx = m.index ?? -1;
    const price = raw.replace(/\s+/g, "");
    if (idx < 0) continue;
    const start = Math.max(0, idx - 60);
    const end = Math.min(t.length, idx + raw.length + 140);
    const ctx = t.slice(start, end);
    const num = priceToNumber(price);
    candidates.push({ price, idx, ctx, num });
    if (candidates.length >= 40) break;
  }

  const isUnitOrSave = (ctx) => {
    const c = String(ctx || "");

    // Ignore savings like "Spare 5€" / "Sie sparen 5 €"
    if (/\b(sparen|spare|save|you\s+save|sie\s+sparen)\b/i.test(c)) return true;

    // Per-unit patterns: 0,05 €/g, 18,00 € / Stück, pro kg, etc.
    if (
      /(?:€\s*\d|\d)\S*\s*(?:\/|\bpro\b|\bper\b)\s*(?:st(\.|\b)|st[üu]ck|stück|einheit|unit|pack|kg|g|l|ml|m|cm|mm|100g|100\s*g)\b/i.test(c)
    )
      return true;

    // Parenthetical unit price
    if (/(\(\s*[^\)]*(?:\/|\bpro\b|\bper\b)\s*[^\)]*\))/i.test(c) && /(€|EUR)/i.test(c)) return true;

    return false;
  };

  let usable = candidates
    .filter((x) => x.price && Number.isFinite(x.num) && x.num > 0)
    .filter((x) => !isUnitOrSave(x.ctx));

  if (!usable.length) return { now: "", was: "" };

  // If there is any "normal" price >= 1.00, drop tiny prices (common unit prices)
  const hasNormal = usable.some((x) => x.num >= 1.0);
  if (hasNormal) usable = usable.filter((x) => x.num >= 0.75);

  const classify = (ctx) => {
    const c = String(ctx || "").toLowerCase();
    if (/(\buvp\b|\bwar\b|\bvorher\b|\burspr(ü|ue)nglich\b|\boriginal\b|\bwas\b|\blist\b)/i.test(c)) return "was";
    if (/(\bjetzt\b|\bdeal\b|\bangebot\b|\bpreis\b|\bnow\b|\bsale\b)/i.test(c)) return "now";
    return "unknown";
  };

  const withType = usable.map((x) => ({ ...x, type: classify(x.ctx) }));

  const pickNow = () =>
    withType.find((x) => x.type === "now") ||
    withType.sort((a, b) => a.num - b.num)[0];

  const nowCand = pickNow();

  const pickWas = () => {
    const bigger = withType.filter((x) => x.num > nowCand.num + 0.001);
    const typed = bigger.find((x) => x.type === "was");
    if (typed) return typed;
    if (bigger.length) return bigger.sort((a, b) => b.num - a.num)[0];
    return undefined;
  };

  const wasCand = pickWas();

  return { now: nowCand?.price || "", was: wasCand?.price || "" };
}



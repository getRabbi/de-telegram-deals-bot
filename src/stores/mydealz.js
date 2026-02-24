import {
  normalizeSpace,
  sanitizePrices,
  calcDiscountPct,
  stripQuery,
  extractPricesFromText
} from "../utils.js";

/**
 * Mydealz RSS fallback (Germany): stable + no API keys.
 * Images in RSS can be inconsistent; we still try to capture one when present.
 */
export async function fetchMydealz({ limit = 40 } = {}) {
  const rss = "https://www.mydealz.de/rss";
  const xml = await fetch(rss).then((r) => r.text());

  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xml))) {
    const block = m[1];

    const title = getTag(block, "title");
    const link = getTag(block, "link");
    const desc = getTag(block, "description");

    const cleanTitle = normalizeSpace(title);
    const url = stripQuery(link);

    if (!cleanTitle || !url) continue;

    // try image from description
    let image = "";
    const imgM = String(desc || "").match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgM) image = imgM[1];

    const prices = sanitizePrices(extractPricesFromText(`${cleanTitle} ${desc || ""}`));
    const discountPct = calcDiscountPct(prices.now, prices.was);

    items.push({
      title: cleanTitle,
      url,
      image,
      now: prices.now,
      was: prices.was,
      discountPct,
      store: "Mydealz"
    });

    if (items.length >= limit) break;
  }

  return items;
}

function getTag(block, tag) {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = String(block || "").match(re);
  const raw = m ? m[1] : "";
  return normalizeSpace(decodeCdata(raw));
}

function decodeCdata(s) {
  return String(s || "")
    .replace(/^<!\[CDATA\[/i, "")
    .replace(/\]\]>$/i, "");
}

import { normalizeSpace, stripQuery, extractPricesFromText, calcDiscountPct, sanitizePrices } from "../utils.js";

// RSS endpoints known to work historically; we try multiple.
const FEEDS = {
  hot: ["https://www.mydealz.de/rss/hot", "https://feeds.feedburner.com/mydealz"],
  new: ["https://www.mydealz.de/rss/new", "https://www.mydealz.de/rss"],
};

function firstMatch(block, re) {
  const m = block.match(re);
  return m ? m[1] : "";
}

function decodeCdata(s) {
  return normalizeSpace(String(s || "").replace(/<!\[CDATA\[|\]\]>/g, ""))
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"');
}

function parseRss(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xml))) {
    const block = m[1];
    const title = decodeCdata(
      firstMatch(block, /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
        firstMatch(block, /<title>([\s\S]*?)<\/title>/)
    );
    const link = stripQuery(firstMatch(block, /<link>([\s\S]*?)<\/link>/));
    const description = decodeCdata(
      firstMatch(block, /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
        firstMatch(block, /<description>([\s\S]*?)<\/description>/)
    );

    // Prefer media thumbnail if present
    const thumb =
      firstMatch(block, /<media:thumbnail[^>]*url="([^"]+)"/i) ||
      firstMatch(block, /<media:content[^>]*url="([^"]+)"/i) ||
      "";

    if (!title || !link) continue;
    items.push({ title, link, description, thumb });
  }
  return items;
}

function classifyStore(url) {
  const u = String(url || "").toLowerCase();

  const map = [
    { tag: "AMAZONDE", store: "Amazon.de", hashtag: "#AmazonDE", test: (s) => s.includes("amazon.de") },
    { tag: "MEDIAMARKT", store: "MediaMarkt", hashtag: "#MediaMarkt", test: (s) => s.includes("mediamarkt.de") },
    { tag: "SATURN", store: "Saturn", hashtag: "#Saturn", test: (s) => s.includes("saturn.de") },
    { tag: "OTTO", store: "OTTO", hashtag: "#OTTO", test: (s) => s.includes("otto.de") },
    { tag: "EBAYDE", store: "eBay.de", hashtag: "#eBayDE", test: (s) => s.includes("ebay.de") },
    { tag: "ZALANDO", store: "Zalando", hashtag: "#Zalando", test: (s) => s.includes("zalando") },
    { tag: "LIDL", store: "Lidl", hashtag: "#Lidl", test: (s) => s.includes("lidl") },
    { tag: "ALDI", store: "ALDI", hashtag: "#ALDI", test: (s) => s.includes("aldi") },
    { tag: "REWE", store: "REWE", hashtag: "#REWE", test: (s) => s.includes("rewe") },
    { tag: "DM", store: "dm", hashtag: "#dm", test: (s) => s.includes("dm.de") || s.includes("dm-drogeriemarkt") },
    { tag: "ROSSMANN", store: "Rossmann", hashtag: "#Rossmann", test: (s) => s.includes("rossmann") },
  ];

  for (const it of map) {
    if (it.test(u)) return it;
  }

  // If it links back to mydealz (internal) or unknown merchant
  return { tag: "MYDEALZ", store: "MyDealz", hashtag: "#MyDealz" };
}

function parseHeat(title) {
  // Common formats: "+123°" or "123°" in title
  const m = String(title || "").match(/([+\-]?\d{1,4})\s*°/);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchMyDealz({ mode = "hot", limit = 80 } = {}) {
  const urls = FEEDS[mode] || FEEDS.hot;
  let xml = "";
  let lastErr = "";

  for (const u of urls) {
    try {
      const res = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) throw new Error(`status=${res.status}`);
      xml = await res.text();
      if (xml && xml.includes("<item")) break;
    } catch (e) {
      lastErr = String(e);
    }
  }

  if (!xml) throw new Error(`MyDealz RSS fetch failed: ${lastErr}`);

  const parsed = parseRss(xml);
  const out = [];

  for (const it of parsed) {
    if (out.length >= limit) break;

    const cls = classifyStore(it.link);
    const prices = extractPricesFromText(`${it.title} ${it.description}`);
    const cleaned = sanitizePrices(prices);
    const pct = calcDiscountPct(cleaned.now, cleaned.was);

    const heat = parseHeat(it.title);
    const isTop = mode === "hot" || heat >= 100;

    out.push({
      id: it.link,
      store: cls.store,
      storeTag: cls.tag,
      title: it.title.replace(/\s*\|\s*mydealz.*/i, "").slice(0, 160),
      now: cleaned.now,
      was: cleaned.was,
      discountPct: pct,
      url: it.link,
      imageUrl: it.thumb,
      heat,
      isTop,
      _hashtag: cls.hashtag,
    });
  }

  return out;
}

export function allStoreTags() {
  return [
    "AMAZONDE",
    "MEDIAMARKT",
    "SATURN",
    "OTTO",
    "EBAYDE",
    "ZALANDO",
    "LIDL",
    "ALDI",
    "REWE",
    "DM",
    "ROSSMANN",
    "MYDEALZ",
  ];
}

export const STORE_META = {
  AMAZONDE: { hashtag: "#AmazonDE", label: "Amazon.de" },
  MEDIAMARKT: { hashtag: "#MediaMarkt", label: "MediaMarkt" },
  SATURN: { hashtag: "#Saturn", label: "Saturn" },
  OTTO: { hashtag: "#OTTO", label: "OTTO" },
  EBAYDE: { hashtag: "#eBayDE", label: "eBay.de" },
  ZALANDO: { hashtag: "#Zalando", label: "Zalando" },
  LIDL: { hashtag: "#Lidl", label: "Lidl" },
  ALDI: { hashtag: "#ALDI", label: "ALDI" },
  REWE: { hashtag: "#REWE", label: "REWE" },
  DM: { hashtag: "#dm", label: "dm" },
  ROSSMANN: { hashtag: "#Rossmann", label: "Rossmann" },
  MYDEALZ: { hashtag: "#MyDealz", label: "MyDealz" },
};

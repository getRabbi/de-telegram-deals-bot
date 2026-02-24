import { withBrowser } from "../browser.js";
import {
  normalizeSpace,
  stripQuery,
  extractPricesFromText,
  sanitizePrices,
  calcDiscountPct
} from "../utils.js";

/**
 * Amazon Germany: discover from Goldbox-like hub.
 * This is intentionally permissive so it returns deals daily.
 */
export async function fetchAmazonDE({ limit = 10 } = {}) {
  const dealsHub = "https://www.amazon.de/gp/goldbox";

  return await withBrowser(async (page) => {
    await page.goto(dealsHub, { waitUntil: "domcontentloaded", timeout: 90_000 });

    // Cookie banner (best effort)
    try {
      const btn = page.getByRole("button", { name: /akzeptieren|alle akzeptieren|accept/i });
      if (await btn.count()) await btn.first().click({ timeout: 2500 });
    } catch {}

    // Let cards render
    try { await page.waitForTimeout(2500); } catch {}

    // Try multiple selectors to find deal cards
    const cardSelectors = [
      '[data-testid="deal-card"]',
      'div.DealCard-module__card',
      'a:has-text("Deal")',
      'a[href*="/dp/"]'
    ];

    let cards = [];
    for (const sel of cardSelectors) {
      try {
        const loc = page.locator(sel);
        const c = await loc.count();
        if (c >= 8) { cards = await loc.elementHandles(); break; }
      } catch {}
    }

    // Fallback: scan links to /dp/
    if (!cards.length) {
      const links = page.locator('a[href*="/dp/"]');
      const c = await links.count();
      cards = await links.first(Math.min(c, 80)).elementHandles();
    }

    const out = [];
    for (const h of cards) {
      if (out.length >= limit) break;

      try {
        const href = (await h.getAttribute("href")) || "";
        const url = href.startsWith("http")
          ? href
          : href
          ? `https://www.amazon.de${href}`
          : "";

        if (!url || !url.includes("amazon.de")) continue;

        // Best-effort title/text
        const text = normalizeSpace((await h.innerText().catch(() => "")) || "");
        if (!text || text.length < 5) continue;

        // Extract prices from visible text
        const prices = sanitizePrices(extractPricesFromText(text));
        const discountPct = calcDiscountPct(prices.now, prices.was);

        // Best-effort title: first line
        const title = text.split("\n").map((x) => x.trim()).filter(Boolean)[0] || "Amazon.de Deal";

        // Best-effort image (if card contains img)
        let image = "";
        try {
          const img = await h.$("img");
          image = (await img?.getAttribute("src")) || "";
        } catch {}

        out.push({
          title,
          url: stripQuery(url),
          image,
          now: prices.now,
          was: prices.was,
          discountPct,
          store: "Amazon.de"
        });
      } catch {}
    }

    return out;
  });
}

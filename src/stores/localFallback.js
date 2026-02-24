import { stripQuery } from "../utils.js";

/**
 * Germany static fallback (never fail).
 * Keeps the bot posting even if stores block scraping on a given day.
 */
export async function fetchLocalFallback() {
  const list = [
    { title: "Amazon.de Deals (Goldbox)", url: "https://www.amazon.de/gp/goldbox", store: "Amazon.de" },
    { title: "MediaMarkt Angebote", url: "https://www.mediamarkt.de/de/campaign/angebote", store: "MediaMarkt" },
    { title: "Saturn Angebote", url: "https://www.saturn.de/de/campaign/angebote", store: "Saturn" },
    { title: "OTTO Angebote", url: "https://www.otto.de/angebote/", store: "OTTO" },
    { title: "Mydealz (Top Deals)", url: "https://www.mydealz.de/", store: "Mydealz" }
  ];

  return list.map((d) => ({ ...d, id: stripQuery(d.url) }));
}

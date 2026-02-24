import { escHtml } from "./utils.js";

export function formatDealCard(deal) {
  const lines = [];

  const header = deal.isTop
    ? "🔥 <b>Top Deal | Top-Angebot 🇩🇪</b>"
    : "🆕 <b>New Deal | Neuer Deal 🇩🇪</b>";

  lines.push(header, "", `<b>${escHtml(deal.title)}</b>`);

  if (deal.store) lines.push(`🏪 ${escHtml(deal.store)}`);

  if (deal.was && deal.now) {
    lines.push(`💶 Was: ${escHtml(deal.was)} → <b>Now: ${escHtml(deal.now)}</b>`);
  } else if (deal.now) {
    lines.push(`💶 <b>Now: ${escHtml(deal.now)}</b>`);
  }

  if (typeof deal.discountPct === "number" && Number.isFinite(deal.discountPct)) {
    lines.push(`🔻 Save: ${deal.discountPct}%`);
  }

  if (deal.extraLine) {
    lines.push(escHtml(deal.extraLine));
  }

  if (deal.hashtags?.length) {
    lines.push("", deal.hashtags.join(" "));
  }

  return lines.join("\n").trim();
}

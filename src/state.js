import fs from "node:fs";
import path from "node:path";

export const STATE_PATH = path.join(process.cwd(), "data", "state.json");

export function loadState(fp = STATE_PATH) {
  try {
    const raw = fs.readFileSync(fp, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed.posted) parsed.posted = [];
    if (!parsed.daily) parsed.daily = { date: "", deals: [], idx: 0, lastHourKey: "" };
    return parsed;
  } catch {
    return { posted: [], daily: { date: "", deals: [], idx: 0, lastHourKey: "" } };
  }
}

export function saveState(data, fp = STATE_PATH) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
}

export function pruneOldPosted(state, daysTtl) {
  const now = Date.now();
  const ttlMs = daysTtl * 24 * 60 * 60 * 1000;
  state.posted = (state.posted || []).filter((p) => now - p.ts < ttlMs);
}

export function dealKey(d) {
  const store = String(d.storeTag || "").toLowerCase();
  const id = String(d.id || d.url || "").toLowerCase();
  return `${store}|${id}`.slice(0, 240);
}

export function rememberPosted(state, deal) {
  state.posted = state.posted || [];
  state.posted.push({ key: dealKey(deal), ts: Date.now() });
}

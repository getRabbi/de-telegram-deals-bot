import fs from "node:fs";
import path from "node:path";

export const STATE_PATH = path.join(process.cwd(), "data", "state.json");

export function berlinNow() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" })
  );
}

export function berlinDateStr() {
  return berlinNow().toISOString().slice(0, 10);
}

export function defaultState(date = berlinDateStr()) {
  return {
    date,
    slots: { morning: false, noon: false, evening: false },
    postedKeys: [],
    postedHistory: [],
  };
}

export function loadState(fp = STATE_PATH) {
  try {
    const raw = fs.readFileSync(fp, "utf8");
    const st = JSON.parse(raw);

    const date = st.date || st.lastDate || (st.daily && st.daily.date) || berlinDateStr();

    const oldSlots = st.slots || st.posted || {};
    const slots = {
      morning: Boolean(oldSlots.morning),
      noon: Boolean(oldSlots.noon),
      evening: Boolean(oldSlots.evening),
    };

    const postedKeys = Array.isArray(st.postedKeys) ? st.postedKeys : [];
    const postedHistory = Array.isArray(st.postedHistory) ? st.postedHistory : [];

    return { date, slots, postedKeys, postedHistory };
  } catch {
    return defaultState();
  }
}

export function saveState(state, fp = STATE_PATH) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(state, null, 2));
}

export function resetIfNewDay(state, today = berlinDateStr()) {
  if (state.date === today) return;

  const keepDays = Number(process.env.DAYS_TTL || 7);
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;

  state.postedHistory = (state.postedHistory || []).filter(
    (p) => p && p.ts && p.ts >= cutoff
  );

  for (const k of state.postedKeys || []) {
    state.postedHistory.push({ key: k, ts: Date.now() });
  }

  state.date = today;
  state.slots = { morning: false, noon: false, evening: false };
  state.postedKeys = [];
}

export function dealKey(deal) {
  const store = String(deal.store || deal.storeTag || "").toLowerCase();
  const url = String(deal.url || deal.link || deal.id || "").toLowerCase();
  return `${store}|${url}`.slice(0, 240);
}

export function wasPostedRecently(state, key) {
  if ((state.postedKeys || []).includes(key)) return true;
  return (state.postedHistory || []).some((p) => p.key === key);
}

export function rememberPosted(state, key) {
  state.postedKeys = state.postedKeys || [];
  state.postedKeys.push(key);
}

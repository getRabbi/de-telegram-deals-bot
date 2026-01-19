// import { loadState, saveState, pruneOldPosted, rememberPosted } from "./state.js";
// import { sendPhotoPost, sendMessage } from "./telegram.js";
// import { formatDealCard } from "./formatPost.js";
// import { sleep, stripQuery } from "./utils.js";
// import { fetchMyDealz, STORE_META } from "./stores/mydealz.js";

// const DAYS_TTL = Number(process.env.DAYS_TTL || 7);
// const DAILY_UNIQUE = Number(process.env.MAX_POSTS_TOTAL || 15); // unique deals/day
// const RATE_LIMIT_MS = Number(process.env.RATE_LIMIT_MS || 3500);

// function todayKeyUTC() {
//   // Use UTC to match GitHub Actions schedule
//   const d = new Date();
//   const y = d.getUTCFullYear();
//   const m = String(d.getUTCMonth() + 1).padStart(2, "0");
//   const day = String(d.getUTCDate()).padStart(2, "0");
//   return `${y}-${m}-${day}`;
// }

// function hourKeyUTC() {
//   const d = new Date();
//   const y = d.getUTCFullYear();
//   const m = String(d.getUTCMonth() + 1).padStart(2, "0");
//   const day = String(d.getUTCDate()).padStart(2, "0");
//   const h = String(d.getUTCHours()).padStart(2, "0");
//   return `${y}-${m}-${day}T${h}`;
// }

// function buildButtons(deal) {
//   return [[{ text: "🔗 Open Deal | Deal öffnen", url: deal.url }]];
// }

// function buildHashtags(deal) {
//   const tags = [];
//   if (deal.isTop) tags.push("#TopDeals");
//   tags.push("#NeueDeals");

//   // store tag
//   const meta = STORE_META[deal.storeTag];
//   if (meta?.hashtag) tags.push(meta.hashtag);

//   // channel-wide tag
//   tags.push("#DeutschlandDeals");
//   return tags;
// }

// async function refreshDailyList(state) {
//   // Pull from both hot + new, merge, dedupe by URL
//   const [hot, fresh] = await Promise.all([
//     fetchMyDealz({ mode: "hot", limit: 120 }),
//     fetchMyDealz({ mode: "new", limit: 120 }),
//   ]);

//   const seen = new Set();
//   const merged = [];

//   // Hot first then new
//   for (const d of [...hot, ...fresh]) {
//     const k = stripQuery(d.url || d.id || "");
//     if (!k || seen.has(k)) continue;
//     seen.add(k);
//     merged.push(d);
//   }

//   // Ensure store diversity as much as possible
//   const byStore = new Map();
//   for (const d of merged) {
//     const arr = byStore.get(d.storeTag) || [];
//     arr.push(d);
//     byStore.set(d.storeTag, arr);
//   }

//   const storesInMenu = [
//     "AMAZONDE",
//     "MEDIAMARKT",
//     "SATURN",
//     "OTTO",
//     "EBAYDE",
//     "ZALANDO",
//     "LIDL",
//     "ALDI",
//     "REWE",
//     "DM",
//     "ROSSMANN",
//     "MYDEALZ",
//   ];

//   const picked = [];

//   // pass 1: at least 1 per store if possible
//   for (const st of storesInMenu) {
//     const arr = byStore.get(st) || [];
//     if (!arr.length) continue;
//     picked.push(arr[0]);
//     if (picked.length >= DAILY_UNIQUE) break;
//   }

//   // pass 2: fill remaining from merged
//   for (const d of merged) {
//     if (picked.length >= DAILY_UNIQUE) break;
//     if (picked.some((x) => x.url === d.url)) continue;
//     picked.push(d);
//   }

//   // if still empty (RSS issue), keep previous deals to avoid going silent
//   if (!picked.length && state.daily?.deals?.length) return;

//   state.daily.deals = picked.slice(0, DAILY_UNIQUE);
//   state.daily.idx = 0;
// }

// async function main() {
//   const state = loadState();
//   pruneOldPosted(state, DAYS_TTL);

//   const today = todayKeyUTC();
//   const hourKey = hourKeyUTC();

//   // Prevent duplicate posts if workflow reruns within same hour.
//   if (state.daily.lastHourKey === hourKey) {
//     console.log(`⏭️ Already posted for this hour (${hourKey}).`);
//     saveState(state);
//     return;
//   }

//   if (state.daily.date !== today) {
//     state.daily.date = today;
//     await refreshDailyList(state);
//   }

//   const list = state.daily.deals || [];
//   if (!list.length) {
//     await sendMessage({
//       text: "⚠️ Heute konnten keine Deals geladen werden. Ich versuche es in der nächsten Stunde erneut.\n\n#DeutschlandDeals",
//       disablePreview: true,
//     });
//     state.daily.lastHourKey = hourKey;
//     saveState(state);
//     return;
//   }

//   const idx = state.daily.idx % list.length;
//   const deal = { ...list[idx] };
//   deal.hashtags = buildHashtags(deal);

//   const caption = formatDealCard(deal);
//   const buttons = buildButtons(deal);

//   // Try photo post, fallback to text
//   try {
//     if (deal.imageUrl) {
//       await sendPhotoPost({ imageUrl: deal.imageUrl, caption, buttons, disablePreview: true });
//     } else {
//       throw new Error("No imageUrl");
//     }
//   } catch {
//     await sendMessage({ text: `${caption}\n\n🔗 ${deal.url}`, buttons, disablePreview: false });
//   }

//   rememberPosted(state, deal);
//   state.daily.idx = idx + 1;
//   state.daily.lastHourKey = hourKey;
//   saveState(state);

//   await sleep(RATE_LIMIT_MS);
//   console.log(`✅ Posted idx=${idx} store=${deal.storeTag}`);
// }

// await main();

import { fetchMyDealzDeals } from "./stores/mydealz.js";
import { sendTelegramMessage } from "./telegram.js";
import { loadState, saveState } from "./state.js";
import { getTimeSlotDE } from "./utils.js";
import { STORES } from "./stores/mydealz.js";

const DEALS_PER_RUN = 3;
const MAX_DAILY_POSTS = 15;

async function run() {
  const slot = getTimeSlotDE();
  if (slot === "off") {
    console.log("⏸ Outside burst hours");
    return;
  }

  const state = loadState();
  const today = new Date().toISOString().slice(0, 10);

  // 🔁 Reset daily
  if (state.lastDate !== today) {
    state.dealPointer = 0;
    state.storePointer = 0;
    state.dailyCount = 0;
    state.lastDate = today;
  }

  if (state.dailyCount >= MAX_DAILY_POSTS) {
    console.log("✅ Daily 15 posts completed");
    return;
  }

  const allDeals = await fetchMyDealzDeals();
  const store = STORES[state.storePointer];

  const storeDeals = allDeals.filter(d =>
    d.store?.toLowerCase().includes(store)
  );

  const dealsToPost = storeDeals.slice(
    state.dealPointer,
    state.dealPointer + DEALS_PER_RUN
  );

  if (dealsToPost.length === 0) {
    state.storePointer =
      state.storePointer + 1 >= STORES.length ? 0 : state.storePointer + 1;
    saveState(state);
    return;
  }

  for (const deal of dealsToPost) {
    await sendTelegramMessage(deal);
  }

  state.dealPointer += DEALS_PER_RUN;
  state.dailyCount += dealsToPost.length;

  // 🔄 rotate store
  state.storePointer =
    state.storePointer + 1 >= STORES.length ? 0 : state.storePointer + 1;

  saveState(state);

  console.log(
    `📤 Posted ${dealsToPost.length} | Total today: ${state.dailyCount}`
  );
}

run();

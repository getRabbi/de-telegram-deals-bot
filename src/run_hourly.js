import { fetchMyDealz, enrichMyDealzMandatory } from "./stores/mydealz.js";
import { sendPhotoPost } from "./telegram.js";
import { formatDealCard } from "./formatPost.js";
import { loadState, saveState, resetIfNewDay, berlinNow, berlinDateStr, dealKey, wasPostedRecently, rememberPosted } from "./state.js";
import { loadQueue, saveQueue, resetQueueIfNewDay, dedupeQueue, capQueue, enqueue, dequeue } from "./queue.js";
import { sleep, scoreDeal } from "./utils.js";

const RATE_LIMIT_MS = Number(process.env.RATE_LIMIT_MS || 3500);
const TARGET_QUEUE_SIZE = Number(process.env.TARGET_QUEUE_SIZE || 60);
const MAX_FETCH_ROUNDS = Number(process.env.MAX_FETCH_ROUNDS || 4);

function slotForBerlinHour(h) {
  if (h === 8) return { slot: "morning", count: 6 };
  if (h === 12) return { slot: "noon", count: 5 };
  if (h === 18) return { slot: "evening", count: 4 };
  return { slot: null, count: 0 };
}

function pickHashtags(deal) {
  const tags = [];
  // category tags for menu search
  if (deal.isTop) tags.push("#TopDeals");
  else tags.push("#NeueDeals");
  if (deal._hashtag) tags.push(deal._hashtag);
  tags.push("#DeutschlandDeals");
  return tags;
}

function channelLinkFromEnv() {
  const chat = process.env.TELEGRAM_CHAT_ID || "";
  if (chat.startsWith("@")) return `https://t.me/${chat.slice(1)}`;
  return "https://t.me/";
}

async function buildPostPayload(deal) {
  const enriched = await enrichMyDealzMandatory(deal);
  if (!enriched) return null;

  // Mandatory fields
  if (!enriched.imageUrl) return null;
  if (!enriched.now) return null;

  // If source doesn't provide "regular/was" price, fall back to now.
  if (!enriched.was) enriched.was = enriched.now;

  // Ensure discount is always present (0 if unknown or no discount)
  if (typeof enriched.discountPct !== "number" || Number.isNaN(enriched.discountPct)) {
    enriched.discountPct = 0;
    try {
      const nowN = Number(String(enriched.now).replace(/[^0-9.,]/g, "").replace(",", "."));
      const wasN = Number(String(enriched.was).replace(/[^0-9.,]/g, "").replace(",", "."));
      if (nowN > 0 && wasN > 0 && wasN >= nowN) {
        enriched.discountPct = Math.round(((wasN - nowN) / wasN) * 100);
      }
    } catch {}
  }

  enriched.hashtags = pickHashtags(enriched);

  const caption = formatDealCard(enriched);
  const buttons = [
    [{ text: "🔗 Open Deal | Deal öffnen", url: enriched.url }],
    [{ text: "📣 Channel", url: channelLinkFromEnv() }],
  ];

  return {
    key: dealKey(enriched),
    store: enriched.store,
    title: enriched.title,
    imageUrl: enriched.imageUrl,
    caption,
    buttons,
    raw: {
      store: enriched.store,
      storeTag: enriched.storeTag,
      title: enriched.title,
      now: enriched.now,
      was: enriched.was,
      discountPct: enriched.discountPct,
      isTop: enriched.isTop,
      url: enriched.url,
      imageUrl: enriched.imageUrl,
      hashtags: enriched.hashtags,
    },
  };
}

function amazonBoost(deal) {
  const s = String(deal.store || "").toLowerCase();
  if (s.includes("amazon")) return 25;
  return 0;
}

function takeRoundRobin(queue, count) {
  const items = Array.isArray(queue.items) ? queue.items : [];
  if (!items.length) return [];

  const storeOrder = [
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

  const buckets = new Map();
  for (const it of items) {
    const tag = it.storeTag || "MYDEALZ";
    if (!buckets.has(tag)) buckets.set(tag, []);
    buckets.get(tag).push(it);
  }

  const picked = [];
  while (picked.length < count) {
    let progressed = false;
    for (const tag of storeOrder) {
      const b = buckets.get(tag);
      if (b && b.length) {
        picked.push(b.shift());
        progressed = true;
        if (picked.length >= count) break;
      }
    }
    if (!progressed) break;
  }

  // rebuild queue.items with remaining items, preserving order per bucket then leftovers
  const remaining = [];
  for (const tag of storeOrder) {
    const b = buckets.get(tag);
    if (b && b.length) remaining.push(...b);
  }
  // any tags not in storeOrder
  for (const [tag, b] of buckets.entries()) {
    if (storeOrder.includes(tag)) continue;
    if (b && b.length) remaining.push(...b);
  }

  queue.items = remaining;
  return picked;
}


async function fillQueue({ state, queue, minToHave }) {
  // Fetch multiple times to grow a buffer.
  for (let round = 0; round < MAX_FETCH_ROUNDS; round++) {
    if ((queue.items?.length || 0) >= minToHave) break;

    const [hot, neu] = await Promise.all([
      fetchMyDealz({ mode: "hot", limit: 120 }),
      fetchMyDealz({ mode: "new", limit: 120 }),
    ]);

    const merged = [...hot, ...neu];

    // Sort: Amazon weighted + deal score
    merged.sort((a, b) => (amazonBoost(b) + scoreDeal(b)) - (amazonBoost(a) + scoreDeal(a)));

    const prepared = [];

    for (const d of merged) {
      if ((queue.items?.length || 0) + prepared.length >= minToHave) break;

      const k = dealKey(d);
      if (wasPostedRecently(state, k)) continue;
      if ((queue.items || []).some((x) => x.key === k)) continue;

      const payload = await buildPostPayload(d);
      if (!payload) continue;

      // Ensure key in payload matches
      payload.key = k;
      prepared.push(payload);
    }

    if (prepared.length) {
      enqueue(queue, prepared);
      dedupeQueue(queue);
      capQueue(queue, 120);
    }

    // Small pause to be kind to sources
    if (round < MAX_FETCH_ROUNDS - 1) await sleep(800);
  }
}

async function postBurst({ state, queue, slot, count }) {
  // Ensure enough items in queue
  await fillQueue({ state, queue, minToHave: Math.max(count, TARGET_QUEUE_SIZE) });

  // If still not enough, try again focusing on just count
  if ((queue.items?.length || 0) < count) {
    await fillQueue({ state, queue, minToHave: count });
  }

  // Pick with store rotation (Amazon first if available)
  const items = takeRoundRobin(queue, count);

  if (!items.length) {
    console.log("⚠️ Queue empty. Nothing to post.");
    return 0;
  }

  let posted = 0;
  for (const it of items) {
    try {
      await sendPhotoPost({
        imageUrl: it.imageUrl,
        caption: it.caption,
        buttons: it.buttons,
        disablePreview: true,
      });
      rememberPosted(state, it.key);
      posted++;
      await sleep(RATE_LIMIT_MS);
    } catch (e) {
      console.log(`❌ Post failed for ${it.key}: ${String(e)}`);
      // If a post fails, do NOT lose the item—push back to end for retry later
      enqueue(queue, [it]);
      await sleep(900);
    }
  }

  state.slots[slot] = true;
  return posted;
}

async function run() {
  const now = berlinNow();
  const today = berlinDateStr();
  const hour = now.getHours();

  const { slot, count } = slotForBerlinHour(hour);

  const state = loadState();
  resetIfNewDay(state, today);

  const queue = loadQueue();
  resetQueueIfNewDay(queue, today);
  dedupeQueue(queue);

  // Always keep queue warm (even outside post hours)
  await fillQueue({ state, queue, minToHave: TARGET_QUEUE_SIZE });

  if (!slot) {
    // Outside release hour: just save queue/state and exit
    saveQueue(queue);
    saveState(state);
    console.log(`🧺 Warmed queue: ${queue.items.length} items | No posting this hour (Berlin ${hour}:00)`);
    return;
  }

  if (state.slots[slot]) {
    console.log(`✅ Slot '${slot}' already posted today. (Berlin ${hour}:00)`);
    saveQueue(queue);
    saveState(state);
    return;
  }

  console.log(`🚀 Posting burst for ${slot} (${count} posts) at Berlin ${hour}:00`);
  const posted = await postBurst({ state, queue, slot, count });

  console.log(`📤 Posted ${posted}/${count} for ${slot}. Queue now: ${queue.items.length}`);

  saveQueue(queue);
  saveState(state);
}

run().catch((e) => {
  console.error("Fatal:", e);
  process.exitCode = 1;
});

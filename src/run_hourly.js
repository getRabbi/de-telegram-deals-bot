import { fetchMyDealz, STORES } from "./stores/mydealz.js";
import { sendTelegramMessage } from "./telegram.js";
import { loadState, saveState } from "./state.js";
import { getTimeSlotDE } from "./utils.js";

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

  // 🔁 Daily reset
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

  // 🔥 Fetch MyDealz deals
  const allDeals = await fetchMyDealz({ mode: "hot", limit: 120 });

  const storeKey = STORES[state.storePointer];
  const storeDeals = allDeals.filter(d =>
    d.store?.toLowerCase().includes(storeKey)
  );

  const dealsToPost = storeDeals.slice(
    state.dealPointer,
    state.dealPointer + DEALS_PER_RUN
  );

  if (!dealsToPost.length) {
    // rotate store if no deals
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

  // 🔄 rotate store after posting
  state.storePointer =
    state.storePointer + 1 >= STORES.length ? 0 : state.storePointer + 1;

  saveState(state);

  console.log(
    `📤 Posted ${dealsToPost.length} | Total today: ${state.dailyCount}`
  );
}

run();

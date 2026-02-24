import { sendPhotoPost } from "./telegram.js";
import { formatDealCard } from "./formatPost.js";

const channelLink =
  (process.env.TELEGRAM_CHAT_ID || "").startsWith("@")
    ? `https://t.me/${process.env.TELEGRAM_CHAT_ID.slice(1)}`
    : "https://t.me/";

const deal = {
  title: "TEST – Demo Deal Card (DE)",
  store: "Amazon.de",
  storeTag: "AMAZONDE",
  now: "19,99 €",
  was: "39,99 €",
  discountPct: 50,
  isTop: true,
  hashtags: ["#TopDeals", "#AmazonDE", "#DeutschlandDeals"],
};

await sendPhotoPost({
  imageUrl: "https://picsum.photos/900/900.jpg",
  caption: formatDealCard(deal),
  buttons: [
    [{ text: "🔗 Open Deal | Deal öffnen", url: "https://www.amazon.de/" }],
    [{ text: "🏪 Open Channel", url: channelLink }],
  ],
});

console.log("✅ Test post sent.");

import { sendMessage, pinMessage } from "./telegram.js";

function channelUsername() {
  const chat = process.env.TELEGRAM_CHAT_ID || "";
  if (chat.startsWith("@")) return chat.slice(1);
  return "";
}

function qLink(username, hashtag) {
  const tag = encodeURIComponent(`#${hashtag}`);
  return `https://t.me/${username}?q=${tag}`;
}

const username = channelUsername();
if (!username) {
  throw new Error("TELEGRAM_CHAT_ID must be in @YourChannel format to enable MENU hashtag search links.");
}

const menuTitle = "<b>DE Deals Menu 🇩🇪 | Angebote & Deals</b>";
const menuText =
  `${menuTitle}\n` +
  `\nTip: Tap buttons to jump to hashtagged posts in this channel.`;

const buttons = [
  // Row 1
  [
    { text: "🔥 Top Deals | Top-Angebote", url: qLink(username, "TopDeals") },
    { text: "🆕 New Deals | Neue Deals", url: qLink(username, "NeueDeals") },
  ],

  // Row 2
  [
    { text: "🛒 Amazon.de | Amazon", url: qLink(username, "AmazonDE") },
    { text: "📺 MediaMarkt | Electronics", url: qLink(username, "MediaMarkt") },
    { text: "🪐 Saturn | Electronics", url: qLink(username, "Saturn") },
  ],

  // Row 3
  [
    { text: "🏠 OTTO | Home & Fashion", url: qLink(username, "OTTO") },
    { text: "💰 eBay.de | Refurb & Clearance", url: qLink(username, "eBayDE") },
    { text: "👟 Zalando | Fashion", url: qLink(username, "Zalando") },
  ],

  // Row 4
  [
    { text: "🥦 Lidl | Grocery", url: qLink(username, "Lidl") },
    { text: "🧺 ALDI | Grocery", url: qLink(username, "ALDI") },
    { text: "🛍️ REWE | Grocery", url: qLink(username, "REWE") },
  ],

  // Row 5
  [
    { text: "💄 dm | Beauty", url: qLink(username, "dm") },
    { text: "🧴 Rossmann | Beauty", url: qLink(username, "Rossmann") },
    { text: "🧯 MyDealz | Community Deals", url: qLink(username, "MyDealz") },
  ],
];

const msg = await sendMessage({ text: menuText, buttons, disablePreview: true });
await pinMessage({ messageId: msg.message_id });

console.log("✅ DE menu posted & pinned.");

# DE Telegram Deals Bot (Germany)

A lightweight Telegram channel bot for **Germany (.de)**.

## What it does
- Builds a **daily pool of 15 unique deals** (from MyDealz RSS: hot + new).
- Posts **1 deal every hour** (UTC, via GitHub Actions).
- After finishing the 15 deals, it **repeats** from the start (hourly repeat), so you get continuous posting.
- Adds hashtags so your pinned menu can jump to stores/categories.

## Supported stores (menu)
- Amazon.de
- MediaMarkt
- Saturn
- OTTO
- eBay.de
- Zalando
- Lidl
- ALDI
- REWE
- dm
- Rossmann
- MyDealz

## Setup
1) Create a Telegram bot with @BotFather and get the token.
2) Create a Telegram channel and add the bot as admin.
3) In GitHub repo settings, add secrets:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID` (must be `@YourChannelUsername`)
4) Run the workflow **Setup DE Deals Menu (Pin)** once to post & pin the menu.

## Posting schedule
- Workflow: `.github/workflows/de_hourly.yml`
- Cron: every hour (UTC) at minute 10

## Config (optional)
Environment variables (GitHub Actions already sets defaults):
- `MAX_POSTS_TOTAL` (default 15) : daily unique deals
- `DAYS_TTL` (default 7) : how long we keep history
- `RATE_LIMIT_MS` (default 3500)

## Local run
```bash
npm install
TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=@yourchannel npm run run:hourly
```


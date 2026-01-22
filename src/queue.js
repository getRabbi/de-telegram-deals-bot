import fs from "node:fs";
import path from "node:path";
import { berlinDateStr } from "./state.js";

export const QUEUE_PATH = path.join(process.cwd(), "data", "queue.json");

export function defaultQueue(date = berlinDateStr()) {
  return {
    date,
    items: [],
    updatedAt: new Date().toISOString(),
  };
}

export function loadQueue(fp = QUEUE_PATH) {
  try {
    const raw = fs.readFileSync(fp, "utf8");
    const q = JSON.parse(raw);
    if (!q.items || !Array.isArray(q.items)) q.items = [];
    if (!q.date) q.date = berlinDateStr();
    return q;
  } catch {
    return defaultQueue();
  }
}

export function saveQueue(queue, fp = QUEUE_PATH) {
  queue.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(queue, null, 2));
}

export function resetQueueIfNewDay(queue, today = berlinDateStr()) {
  if (queue.date === today) return;
  // Keep queue across days so daily 15 never stops
  queue.date = today;
  queue.updatedAt = new Date().toISOString();
}

export function dedupeQueue(queue) {
  const seen = new Set();
  const out = [];
  for (const it of queue.items || []) {
    if (!it || !it.key) continue;
    if (seen.has(it.key)) continue;
    seen.add(it.key);
    out.push(it);
  }
  queue.items = out;
}

export function capQueue(queue, maxSize = 100) {
  if (!Array.isArray(queue.items)) queue.items = [];
  if (queue.items.length <= maxSize) return;
  queue.items = queue.items.slice(0, maxSize);
}

export function enqueue(queue, items) {
  if (!Array.isArray(queue.items)) queue.items = [];
  const existing = new Set(queue.items.map((x) => x.key));
  for (const it of items) {
    if (!it || !it.key) continue;
    if (existing.has(it.key)) continue;
    queue.items.push(it);
    existing.add(it.key);
  }
}

export function dequeue(queue, n) {
  if (!Array.isArray(queue.items)) queue.items = [];
  const take = queue.items.slice(0, n);
  queue.items = queue.items.slice(n);
  return take;
}

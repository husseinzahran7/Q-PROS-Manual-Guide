import type { ActionPayload } from "./types";

export function actionFingerprint(action: ActionPayload) {
  return [
    action.type,
    action.page.url,
    action.target.selector,
    action.target.xpath,
    action.key || "",
    action.valuePolicy === "literal" ? action.value || "" : action.valuePolicy,
    action.dialog ? `${action.dialog.kind}|${action.dialog.message ?? ""}|${action.dialog.response ?? ""}|${action.dialog.accepted ?? ""}` : ""
  ].join("|");
}

export type DedupeSnapshot = Array<[string, number]>;

export class RecentActionDeduper {
  private recent = new Map<string, number>();

  constructor(private readonly ttlMs = 900) {}

  get size() {
    return this.recent.size;
  }

  get ttl() {
    return this.ttlMs;
  }

  snapshot(): DedupeSnapshot {
    return Array.from(this.recent.entries());
  }

  restore(entries: unknown, nowMs = Date.now()) {
    if (!Array.isArray(entries)) return;
    for (const entry of entries as Array<unknown>) {
      if (!Array.isArray(entry) || entry.length !== 2) continue;
      const [key, timestamp] = entry as [unknown, unknown];
      if (typeof key !== "string" || typeof timestamp !== "number") continue;
      if (!Number.isFinite(timestamp)) continue;
      // Drop long-expired entries so a hours-old suspend doesn't pin memory.
      // Keep a 5x TTL grace so a just-suspended SW still dedupes on wake.
      if (nowMs - timestamp > this.ttlMs * 5) continue;
      this.recent.set(key, timestamp);
    }
  }

  clear() {
    this.recent.clear();
  }

  shouldAccept(action: ActionPayload, nowMs = Date.now()) {
    const fingerprint = actionFingerprint(action);
    for (const [key, timestamp] of this.recent) {
      if (nowMs - timestamp > this.ttlMs) {
        this.recent.delete(key);
      }
    }
    const lastSeen = this.recent.get(fingerprint);
    if (lastSeen && nowMs - lastSeen <= this.ttlMs) {
      return false;
    }
    this.recent.set(fingerprint, nowMs);
    return true;
  }
}

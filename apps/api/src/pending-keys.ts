/**
 * One-time in-memory store for newly generated API keys.
 * After billing activates, the raw key is stored here for 5 minutes.
 * The /app route consumes it once to display to the merchant, then it's gone.
 */

const _store = new Map<string, { key: string; expiresAt: number }>();

export function storePendingKey(shop: string, key: string): void {
  _store.set(shop, { key, expiresAt: Date.now() + 5 * 60 * 1000 });
}

export function consumePendingKey(shop: string): string | null {
  const entry = _store.get(shop);
  _store.delete(shop);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.key;
}

/**
 * 5-min per-instance in-memory cache for AI responses.
 * Per spec §16: "Cache 5 min per location, don't re-generate on every view".
 * NOTE: per-Vercel-instance, not global. Acceptable for hackathon.
 */
const DEFAULT_TTL_MS = 5 * 60_000;

interface Entry {
  value: string;
  expiresAt: number;
}

const cache = new Map<string, Entry>();

export const getCached = (key: string): string | null => {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  if (hit) cache.delete(key);
  return null;
};

export const setCached = (
  key: string,
  value: string,
  ttlMs: number = DEFAULT_TTL_MS,
): void => {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
};

import type { InstantType } from "@/types";

// All Instants live for 24h regardless of type. Keep the param so the
// signature stays drop-in if we ever want per-type variation back.
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const EXPIRY_HOURS = 24;

export const calcExpiresAt = (_type: InstantType): Date =>
  new Date(Date.now() + ONE_DAY_MS);

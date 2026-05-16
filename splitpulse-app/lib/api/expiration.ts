import type { InstantType } from "@/types";

// Source: SPLIT_PULSE_TECHNICAL_SPEC.md §5.1
const EXPIRY_MINUTES: Record<InstantType, number> = {
  crowd: 60,
  event: 480,
  help: 120,
  question: 240,
  recommendation: 360,
  warning: 120,
  photo: 1440,
  text: 1440,
};

export const calcExpiresAt = (type: InstantType): Date =>
  new Date(Date.now() + (EXPIRY_MINUTES[type] ?? 1440) * 60_000);

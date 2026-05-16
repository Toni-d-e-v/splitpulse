import type { InstantType } from "@/types";

export interface InstantTypeMeta {
  label: string;
  icon: string;
  color: string;
}

export const INSTANT_TYPE_META: Record<InstantType, InstantTypeMeta> = {
  photo:          { label: "Photo",       icon: "📷", color: "var(--instant-photo)" },
  text:           { label: "Text",        icon: "💬", color: "var(--instant-text)" },
  crowd:          { label: "Crowd",       icon: "👥", color: "var(--instant-crowd)" },
  question:       { label: "Question",    icon: "❓", color: "var(--instant-question)" },
  help:           { label: "Help",        icon: "🆘", color: "var(--instant-help)" },
  event:          { label: "Event",       icon: "⚡", color: "var(--instant-event)" },
  recommendation: { label: "Recommend",   icon: "⭐", color: "var(--instant-recommend)" },
  warning:        { label: "Warning",     icon: "⚠️", color: "var(--instant-warning)" },
};

export const FILTER_TYPES: Array<InstantType | "all"> = [
  "all",
  "crowd",
  "help",
  "event",
  "question",
  "warning",
  "recommendation",
];

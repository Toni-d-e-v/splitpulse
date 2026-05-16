// Source: SPLIT_PULSE_TECHNICAL_SPEC.md §11, §18.3

export type PulseStatus =
  | "quiet"
  | "active"
  | "rising"
  | "trending"
  | "high_pulse"
  | "live_event";

export type InstantType =
  | "photo"
  | "text"
  | "crowd"
  | "question"
  | "help"
  | "event"
  | "recommendation"
  | "warning";

export type ReactionType = "confirm" | "helpful" | "answer";

export interface Profile {
  id: string;
  pulse_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  streak_count: number;
  streak_last_date: string | null;
  pulse_points: number;
  helper_score: number;
  created_at: string;
  updated_at: string;
}

export interface Location {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: string;
  tags: string[];
  latitude: number;
  longitude: number;
  radius_meters: number;
  parent_id: string | null;
  pulse_score: number;
  pulse_status: PulseStatus;
  is_event_zone: boolean;
  event_name: string | null;
  event_ends_at: string | null;
}

export interface Instant {
  id: string;
  user_id: string | null;
  location_id: string;
  type: InstantType;
  content: string | null;
  image_url: string | null;
  latitude: number;
  longitude: number;
  expires_at: string;
  is_resolved: boolean;
  confirm_count: number;
  helpful_count: number;
  is_anonymous: boolean;
  created_at: string;
  location?: Location;
  profile?: Pick<Profile, "pulse_name" | "avatar_url">;
}

export interface InstantReaction {
  id: string;
  instant_id: string;
  user_id: string;
  type: ReactionType;
  content: string | null;
  created_at: string;
}

export interface LocationDetail extends Location {
  active_instants: Instant[];
  ai_summary: string | null;
  active_users_count: number;
}

export interface Favorite {
  id: string;
  location_id: string;
  note: string | null;
  collection_id: string | null;
  created_at: string;
  location?: Location;
}

export interface FavoriteCollection {
  id: string;
  name: string;
  emoji: string;
  is_public: boolean;
  share_slug: string | null;
  created_at: string;
  favorites?: Favorite[];
}

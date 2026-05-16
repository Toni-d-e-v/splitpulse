import { z } from "zod";

export const INSTANT_TYPES = [
  "photo",
  "text",
  "crowd",
  "question",
  "help",
  "event",
  "recommendation",
  "warning",
] as const;

export const REACTION_TYPES = ["confirm", "helpful", "answer"] as const;

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);

export const CreateInstantSchema = z.object({
  type: z.enum(INSTANT_TYPES).default("text"),
  content: z.string().max(280).optional(),
  latitude: lat,
  longitude: lng,
  location_id: z.string().uuid().optional(),
  is_anonymous: z.boolean().optional().default(false),
  // image is handled separately when multipart/form-data is used
});

export type CreateInstantInput = z.infer<typeof CreateInstantSchema>;

export const ReactionSchema = z.object({
  type: z.enum(REACTION_TYPES),
  content: z.string().max(280).optional(),
});

export const AISummarySchema = z.object({
  location_id: z.string().uuid(),
});

export const AIAskSchema = z.object({
  location_id: z.string().uuid(),
  question: z.string().min(1).max(280),
});

export const PulseNameSchema = z.object({
  pulse_name: z
    .string()
    .min(2)
    .max(24)
    .regex(/^[a-zA-Z0-9_-]+$/, "Letters, numbers, _ or - only"),
});

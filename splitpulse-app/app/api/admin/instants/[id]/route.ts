import { createServiceClient } from "@/lib/supabase/service";
import { errorResponse } from "@/lib/api/errors";
import type { InstantType } from "@/types";

const VALID_TYPES: InstantType[] = [
  "photo",
  "text",
  "crowd",
  "question",
  "help",
  "event",
  "recommendation",
  "warning",
];

/**
 * Hackathon admin API — no auth, edits any instant via service client.
 * DO NOT ship without adding an auth gate.
 */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return errorResponse("Invalid JSON", "INVALID_INPUT");
  }

  const update: Record<string, unknown> = {};
  if (typeof body.content === "string") update.content = body.content;
  if (body.content === null) update.content = null;
  if (typeof body.type === "string") {
    if (!VALID_TYPES.includes(body.type as InstantType)) {
      return errorResponse("Invalid type", "INVALID_INPUT");
    }
    update.type = body.type;
  }
  if (typeof body.is_resolved === "boolean") update.is_resolved = body.is_resolved;
  if (typeof body.is_anonymous === "boolean") update.is_anonymous = body.is_anonymous;
  if (typeof body.expires_at === "string") update.expires_at = body.expires_at;
  if (typeof body.image_url === "string" || body.image_url === null) {
    update.image_url = body.image_url;
  }

  if (Object.keys(update).length === 0) {
    return errorResponse("No fields to update", "INVALID_INPUT");
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from("instants")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return errorResponse(error.message, "INTERNAL");
  if (!data) return errorResponse("Not found", "NOT_FOUND");

  return Response.json({ instant: data });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const service = createServiceClient();
  const { error } = await service.from("instants").delete().eq("id", id);
  if (error) return errorResponse(error.message, "INTERNAL");
  return Response.json({ ok: true });
}

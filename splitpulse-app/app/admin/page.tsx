import { createServiceClient } from "@/lib/supabase/service";
import { AdminPanel } from "@/components/admin/AdminPanel";
import type { Instant, Location } from "@/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  const service = createServiceClient();

  const [{ data: rawInstants }, { data: locations }] = await Promise.all([
    service
      .from("instants")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    service.from("locations_view").select("*"),
  ]);

  const locationsById = new Map<string, Location>(
    ((locations ?? []) as Location[]).map((location) => [location.id, location]),
  );

  const instants: Instant[] = ((rawInstants ?? []) as Array<Record<string, unknown>>).map(
    (row) => {
      const location = locationsById.get(row.location_id as string);
      return {
        id: row.id as string,
        user_id: (row.user_id as string | null) ?? null,
        location_id: row.location_id as string,
        type: row.type as Instant["type"],
        content: (row.content as string | null) ?? null,
        image_url: (row.image_url as string | null) ?? null,
        latitude: location?.latitude ?? 0,
        longitude: location?.longitude ?? 0,
        expires_at: row.expires_at as string,
        is_resolved: Boolean(row.is_resolved),
        confirm_count: (row.confirm_count as number) ?? 0,
        helpful_count: (row.helpful_count as number) ?? 0,
        is_anonymous: Boolean(row.is_anonymous),
        created_at: row.created_at as string,
        location,
      };
    },
  );

  return (
    <AdminPanel
      instants={instants}
      locations={(locations ?? []) as Location[]}
    />
  );
}

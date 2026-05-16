import { createClient } from "@/lib/supabase/server";
import { MapClient } from "@/components/map/MapClient";
import type { Instant, Location } from "@/types";

export const dynamic = "force-dynamic";

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const { focus } = await searchParams;
  const supabase = await createClient();

  const [{ data: locationsData }, { data: instantsData }, { data: { user } }] =
    await Promise.all([
      supabase.from("locations_view").select("*"),
      supabase.from("active_instants").select("*").limit(200),
      supabase.auth.getUser(),
    ]);

  const locations = (locationsData ?? []) as Location[];
  const instants = (instantsData ?? []) as Instant[];
  const pulseName = user?.user_metadata?.pulse_name ?? null;

  return (
    <main className="relative isolate h-dvh w-screen overflow-hidden bg-deep">
      {/* Backdrop while map loads / if token missing */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, rgba(0,212,255,0.10), transparent 55%), radial-gradient(circle at 30% 80%, rgba(255,184,0,0.08), transparent 50%)",
        }}
      />

      <MapClient
        initialLocations={locations}
        initialInstants={instants}
        focusSlug={focus ?? null}
        pulseName={pulseName}
        userInitial={user?.email?.[0] ?? "@"}
      />
    </main>
  );
}

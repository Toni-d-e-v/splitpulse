import { PostInstantClient } from "@/components/instant/PostInstantClient";
import { createClient } from "@/lib/supabase/server";
import type { Location } from "@/types";

export default async function NewInstantPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>;
}) {
  const { location } = await searchParams;
  const supabase = await createClient();

  const [{ data: locationsData }, { data: { user } }] = await Promise.all([
    supabase
      .from("locations_view")
      .select("*")
      .order("name", { ascending: true }),
    supabase.auth.getUser(),
  ]);

  let pulseName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("pulse_name")
      .eq("id", user.id)
      .maybeSingle();
    pulseName = profile?.pulse_name ?? null;
  }

  return (
    <main className="min-h-dvh bg-deep text-[var(--text-primary)]">
      <PostInstantClient
        locations={(locationsData as Location[] | null) ?? []}
        initialLocationSlug={location ?? null}
        pulseName={pulseName}
      />
    </main>
  );
}

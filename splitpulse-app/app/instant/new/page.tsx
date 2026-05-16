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
  const { data } = await supabase
    .from("locations_view")
    .select("*")
    .order("name", { ascending: true });

  return (
    <main className="min-h-screen bg-deep text-[var(--text-primary)] p-4">
      <PostInstantClient
        locations={(data as Location[] | null) ?? []}
        initialLocationSlug={location ?? null}
      />
    </main>
  );
}

import { Suspense } from "react";
import { ChatClient } from "@/components/chat/ChatClient";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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
    <main className="min-h-dvh bg-deep">
      <Suspense fallback={null}>
        <ChatClient initialQuery={q ?? null} pulseName={pulseName} />
      </Suspense>
    </main>
  );
}

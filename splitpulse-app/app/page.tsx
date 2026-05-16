import { redirect } from "next/navigation";

export default async function Landing({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string }>;
}) {
  const { zone } = await searchParams;
  redirect(zone ? `/map?focus=${encodeURIComponent(zone)}` : "/map");
}

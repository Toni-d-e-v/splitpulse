import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request.
 * Pattern: https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value),
          );
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touch the session — refresh tokens if needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auth gate: unauthenticated users see /login (incl. landing).
  const path = req.nextUrl.pathname;
  const PUBLIC_PATHS = ["/login", "/auth/callback", "/api/og"];
  const isPublicRead =
    req.method === "GET" &&
    (path === "/" ||
      path === "/map" ||
      path === "/api/locations" ||
      /^\/api\/locations\/[^/]+$/.test(path) ||
      path === "/api/instants");
  const isPublic =
    isPublicRead ||
    PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/")) ||
    path.startsWith("/api/auth/") ||
    path.startsWith("/api/cron/") ||
    path.startsWith("/_next/") ||
    path === "/favicon.ico";

  if (!user && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    // Preserve where they wanted to go.
    if (path !== "/") url.searchParams.set("next", path + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // Signed-in user landing on /login → straight to /map.
  if (user && path === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/map";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    // Skip Next.js internals, static assets, and OG image generation.
    "/((?!_next/static|_next/image|favicon.ico|api/og).*)",
  ],
};

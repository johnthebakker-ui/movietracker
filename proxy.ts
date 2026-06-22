import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });
  const user = (await supabase.auth.getUser()).data.user;
  if (user) {
    const path = request.nextUrl.pathname; const allowed = path === "/login" || path.startsWith("/auth/mfa") || path.startsWith("/auth/callback");
    if (!allowed) { const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(); if (assurance.data?.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") { if (path.startsWith("/api/")) return NextResponse.json({ error: "MFA challenge required" }, { status: 403 }); const target = request.nextUrl.clone(); target.pathname = "/auth/mfa"; target.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`; const redirectResponse = NextResponse.redirect(target); response.cookies.getAll().forEach(cookie => redirectResponse.cookies.set(cookie)); return redirectResponse; } }
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };

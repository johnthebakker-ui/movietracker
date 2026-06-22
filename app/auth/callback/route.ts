import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { needsMfaChallenge } from "@/lib/auth-security";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requested = url.searchParams.get("next") ?? "/"; const next = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase?.auth.exchangeCodeForSession(code);
    if (supabase && await needsMfaChallenge(supabase)) return NextResponse.redirect(new URL(`/auth/mfa?next=${encodeURIComponent(next)}`, url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}

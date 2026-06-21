import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { traktAuthorizeUrl } from "@/lib/trakt";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient(); const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) return NextResponse.redirect(new URL("/login?message=Sign+in+to+connect+Trakt", request.url));
  try { const state = randomUUID(); const response = NextResponse.redirect(traktAuthorizeUrl(state)); response.cookies.set("trakt_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 }); return response; }
  catch (error) { return NextResponse.redirect(new URL(`/settings/integrations?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not start Trakt authorization")}`, request.url)); }
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { exchangeTraktCode, getTraktUser, saveTraktConnection } from "@/lib/trakt";

export async function GET(request: Request) {
  const url = new URL(request.url); const code = url.searchParams.get("code"); const state = url.searchParams.get("state"); const error = url.searchParams.get("error");
  const cookieStore = await cookies(); const expectedState = cookieStore.get("trakt_oauth_state")?.value; cookieStore.delete("trakt_oauth_state");
  if (error) return NextResponse.redirect(new URL(`/settings/integrations?error=${encodeURIComponent(error)}`, request.url));
  if (!code || !state || !expectedState || state !== expectedState) return NextResponse.redirect(new URL("/settings/integrations?error=Invalid+or+expired+Trakt+authorization", request.url));
  const supabase = await createSupabaseServerClient(); const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) return NextResponse.redirect(new URL("/login?message=Sign+in+again+before+connecting+Trakt", request.url));
  try { const token = await exchangeTraktCode(code); const settings = await getTraktUser(token.access_token); await saveTraktConnection(user.id, token, settings); return NextResponse.redirect(new URL("/settings/integrations?connected=1", request.url)); }
  catch (caught) { return NextResponse.redirect(new URL(`/settings/integrations?error=${encodeURIComponent(caught instanceof Error ? caught.message : "Could not connect Trakt")}`, request.url)); }
}

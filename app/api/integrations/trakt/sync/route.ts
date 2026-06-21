import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncTraktForUser } from "@/lib/trakt";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient(); const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try { return NextResponse.json(await syncTraktForUser(user.id, new URL(request.url).searchParams.get("force") === "1")); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Trakt sync failed" }, { status: 500 }); }
}

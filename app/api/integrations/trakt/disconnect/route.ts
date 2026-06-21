import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseServerClient(); const user = supabase ? (await supabase.auth.getUser()).data.user : null; if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const admin = createSupabaseAdminClient(); if (!admin) return NextResponse.json({ error: "Supabase service client unavailable" }, { status: 500 });
  const { error } = await admin.from("trakt_connections").delete().eq("user_id", user.id); if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

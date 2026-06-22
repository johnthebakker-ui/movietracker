import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) return NextResponse.json({ error: "Sign in to use your lists" }, { status: 401 });
  const { data, error } = await supabase.from("lists").select("id,name").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(250);
  if (error) return NextResponse.json({ error: "Could not load your lists" }, { status: 500 });
  return NextResponse.json({ lists: data ?? [] });
}


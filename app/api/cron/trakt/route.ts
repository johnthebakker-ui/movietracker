import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { syncTraktForUser } from "@/lib/trakt";

export async function GET(request: Request) {
  if (!env.cronSecret || request.headers.get("authorization") !== `Bearer ${env.cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createSupabaseAdminClient(); if (!admin) return NextResponse.json({ error: "Supabase service client unavailable" }, { status: 500 });
  const { data, error } = await admin.from("trakt_connections").select("user_id").eq("sync_enabled", true).order("last_synced_at", { ascending: true, nullsFirst: true }).limit(25); if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const results = await Promise.allSettled((data ?? []).map(row => syncTraktForUser(row.user_id)));
  return NextResponse.json({ processed: results.length, succeeded: results.filter(result => result.status === "fulfilled").length, failed: results.filter(result => result.status === "rejected").length });
}

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) return NextResponse.json({ error: "Sign in to use your lists" }, { status: 401 });
  const url = new URL(request.url); const tmdbId = Number(url.searchParams.get("tmdbId")); const kind = url.searchParams.get("kind") === "show" ? "show" : "movie";
  const { data, error } = await supabase.from("lists").select("id,name").eq("user_id", user.id).order("name", { ascending: true }).limit(250);
  if (error) return NextResponse.json({ error: "Could not load your lists" }, { status: 500 });
  let mediaId: number | null = null; let progressStatus: string | null = null; let favorite = false; let watched = false; const memberships = new Set<string>();
  if (Number.isInteger(tmdbId) && tmdbId > 0) {
    mediaId = (await supabase.from("media").select("id").eq("tmdb_id", tmdbId).eq("kind", kind).maybeSingle()).data?.id ?? null;
    if (mediaId) {
      const listIds = (data ?? []).map(list => list.id);
      const [items, progress, favoriteRow, watchCount] = await Promise.all([
        listIds.length ? supabase.from("list_items").select("list_id").eq("media_id", mediaId).in("list_id", listIds) : Promise.resolve({ data: [] }),
        supabase.from("progress").select("status").eq("user_id", user.id).eq("media_id", mediaId).maybeSingle(),
        supabase.from("favorites").select("media_id").eq("user_id", user.id).eq("media_id", mediaId).maybeSingle(),
        supabase.from("watch_events").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("media_id", mediaId)
      ]);
      (items.data ?? []).forEach(row => memberships.add(row.list_id)); progressStatus = progress.data?.status ?? null;
      favorite = Boolean(favoriteRow.data); watched = Boolean(watchCount.count) || progressStatus === "completed";
    }
  }
  return NextResponse.json({ lists: (data ?? []).map(list => ({ ...list, contains: memberships.has(list.id) })), state: { progressStatus, favorite, watched } });
}

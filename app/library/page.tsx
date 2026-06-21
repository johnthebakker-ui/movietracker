import Link from "next/link";
import { List as ListIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { MediaCard } from "@/components/media-card";
import { withCommunityRatings } from "@/lib/community-ratings";
import { fromDbMedia } from "@/lib/db-mappers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function Library({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!supabase || !user) redirect("/login");
  let query = supabase.from("progress").select("status,updated_at,media(*)").eq("user_id", user.id).order("updated_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data } = await query;
  const rawItems = (data ?? []).map((row: any) => row.media).filter(Boolean).map(fromDbMedia);
  const items = await withCommunityRatings(rawItems, supabase);
  return <main className="page"><div className="shell"><div className="page-heading-row library-heading"><div><div className="eyebrow">Your screen life</div><h1 className="display" style={{ fontSize: "clamp(3rem,7vw,6rem)", margin: "8px 0" }}>My library</h1></div><Link className="button ghost" href="/lists"><ListIcon size={16} /> Your lists</Link></div><nav className="filter-bar">{[["", "Everything"], ["planned", "Watchlist"], ["watching", "Watching"], ["completed", "Completed"], ["paused", "Paused"], ["dropped", "Dropped"]].map(([value, label]) => <a className={`button small ${status === value || (!status && !value) ? "accent" : "ghost"}`} href={value ? `/library?status=${value}` : "/library"} key={value}>{label}</a>)}</nav>{items.length ? <div className="media-grid">{items.map(item => <MediaCard key={`${item.kind}-${item.id}`} item={item} />)}</div> : <div className="empty-state"><h2 className="display">Nothing here yet</h2><p className="muted">When you track a title, it will settle in here.</p><a className="button accent" href="/discover">Discover something</a></div>}</div></main>;
}

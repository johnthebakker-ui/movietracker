import Link from "next/link";
import { List } from "lucide-react";
import { redirect } from "next/navigation";
import { CreateListDialog } from "@/components/create-list-dialog";
import { ListCardArt } from "@/components/list-card-art";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { imageUrl } from "@/lib/tmdb";

export default async function ListsPage() {
  const supabase = await createSupabaseServerClient(); const user = supabase ? (await supabase.auth.getUser()).data.user : null; if (!supabase || !user) redirect("/login");
  const { data: rawLists } = await supabase.from("lists").select("id,name,description,visibility,updated_at,cover_url,featured_media_id").eq("user_id", user.id).order("updated_at", { ascending: false });
  const lists = await Promise.all((rawLists ?? []).map(async list => { const [{ data: items }, { count }, { data: featured }] = await Promise.all([supabase.from("list_items").select("position,media(id,poster_path,backdrop_path,title)").eq("list_id", list.id).order("position").limit(4), supabase.from("list_items").select("id", { count: "exact", head: true }).eq("list_id", list.id), list.featured_media_id ? supabase.from("media").select("id,poster_path,backdrop_path,title").eq("id", list.featured_media_id).maybeSingle() : Promise.resolve({ data: null })]); return { ...list, items: items ?? [], count: count ?? 0, featured }; }));
  return <main className="page"><div className="shell"><div className="page-heading-row"><div><div className="eyebrow">Curate without limits</div><h1 className="display page-title">Your lists</h1><p className="muted">Collections stay fast no matter how many titles they contain; covers use only the first four posters.</p></div><CreateListDialog /></div>
    {lists.length ? <div className="lists-library-grid">{lists.map(list => { const posters = list.items.map((item: any) => imageUrl(item.media?.poster_path, "w300")).filter(Boolean) as string[]; const featuredArt = imageUrl(list.featured?.backdrop_path || list.featured?.poster_path, "w780"); return <Link className="library-list-card" href={`/lists/${list.id}`} key={list.id}><ListCardArt customCover={list.cover_url} featuredArt={featuredArt} posters={posters} /><div className="library-list-copy"><span className="eyebrow">{list.visibility}</span><h2>{list.name}</h2><p>{list.description || "A hand-picked collection."}</p><strong>{list.count.toLocaleString()} {list.count === 1 ? "title" : "titles"}</strong></div></Link>; })}</div> : <div className="empty-state"><List size={30} /><h2 className="display">Start your first list</h2><p className="muted">Rank favorites, plan a marathon, or catalog films about suspicious lighthouses.</p></div>}
  </div></main>;
}

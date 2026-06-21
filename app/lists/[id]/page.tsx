import Image from "next/image";
import { List } from "lucide-react";
import { notFound } from "next/navigation";
import { EditListDialog } from "@/components/edit-list-dialog";
import { MediaCard } from "@/components/media-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fromDbMedia } from "@/lib/db-mappers";
import { imageUrl } from "@/lib/tmdb";

export default async function ListDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  if (!supabase) notFound();
  const [{ data: list }, { data: userData }] = await Promise.all([
    supabase.from("lists").select("*,profiles(username,display_name)").eq("id", id).maybeSingle(),
    supabase.auth.getUser()
  ]);
  if (!list) notFound();
  const { data: items } = await supabase.from("list_items").select("position,note,media(*)").eq("list_id", id).order("position");
  const rows = (items ?? []).map((row: any) => ({ ...row, media: Array.isArray(row.media) ? row.media[0] : row.media })).filter((row: any) => row.media);
  const isOwner = userData.user?.id === list.user_id;
  const featured = rows.find((row: any) => row.media?.id === list.featured_media_id)?.media;
  const heroArt = list.cover_url || imageUrl(featured?.backdrop_path || featured?.poster_path, "original");
  const owner = Array.isArray(list.profiles) ? list.profiles[0] : list.profiles;

  return <main className="page list-detail-page"><div className="shell">
    <section className={`list-detail-hero${heroArt ? " has-art" : ""}`}>
      {heroArt && <Image className="list-detail-art" src={heroArt} alt="" fill priority sizes="100vw" />}
      <div className="list-detail-copy"><div className="eyebrow">{list.visibility} list · @{owner?.username}</div><h1 className="display">{list.name}</h1><p>{list.description || "A hand-picked collection."}</p><strong>{rows.length.toLocaleString()} {rows.length === 1 ? "title" : "titles"}</strong></div>
      {isOwner && <EditListDialog list={list} items={rows.map((row: any) => ({ id: row.media.id, title: row.media.title }))} />}
    </section>
    {rows.length ? <div className="media-grid section">{rows.map((row: any) => <MediaCard key={row.media.id} item={fromDbMedia(row.media)} />)}</div> : <div className="empty-state list-empty-state"><List size={30} /><h2 className="display">This list is waiting</h2><p className="muted">You can edit its name, description, privacy and cover now, then add titles from any movie or series page.</p>{isOwner && <EditListDialog list={list} items={[]} />}</div>}
  </div></main>;
}

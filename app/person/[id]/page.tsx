import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { MediaCard } from "@/components/media-card";
import { getPerson, imageUrl } from "@/lib/tmdb";

export default async function PersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string; year?: string }> }) {
  const { id } = await params; const filters = await searchParams; if (!Number.isFinite(Number(id))) notFound(); const person = await getPerson(Number(id));
  const credits = person.credits.filter(item => !filters.kind || item.kind === filters.kind).filter(item => !filters.year || item.releaseDate?.startsWith(filters.year));
  return <main className="page"><div className="shell"><section className="entity-hero">{person.profilePath ? <Image className="entity-portrait" src={imageUrl(person.profilePath, "h632")!} width={420} height={632} alt={person.name} priority /> : <div className="entity-portrait" />}<div><div className="eyebrow">{person.knownFor || "Cast & crew"}</div><h1 className="display page-title">{person.name}</h1>{person.placeOfBirth && <p className="entity-meta"><MapPin size={14} /> {person.placeOfBirth}</p>}<p className="overview entity-bio">{person.biography || "No biography has been published yet."}</p></div></section>
    <div className="section-head"><div><div className="eyebrow">Complete screen credits</div><h2 className="display">Movies & series</h2></div></div><form className="recommendation-filter entity-filters"><select className="select" name="kind" defaultValue={filters.kind ?? ""}><option value="">All formats</option><option value="movie">Movies</option><option value="show">Series</option></select><input className="input" name="year" maxLength={4} placeholder="Year" defaultValue={filters.year} /><button className="button accent">Filter</button></form><div className="media-grid">{credits.map(item => <MediaCard item={item} key={`${item.kind}-${item.id}`} />)}</div>{!credits.length && <div className="empty-state"><h2 className="display">No matching credits</h2></div>}
    <Link className="text-link" href="/discover">← Back to discovery</Link>
  </div></main>;
}

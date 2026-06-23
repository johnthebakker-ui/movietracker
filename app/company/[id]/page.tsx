import Image from "@/components/app-image";
import { Building2, MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { InfiniteMediaGrid } from "@/components/infinite-media-grid";
import { getCompany, imageUrl } from "@/lib/tmdb";
import { withCommunityRatings } from "@/lib/community-ratings";

export default async function CompanyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kind?: string; year?: string }> }) {
  const { id } = await params; const filters = await searchParams;
  if (!Number.isFinite(Number(id))) notFound();
  const year = /^\d{4}$/.test(filters.year ?? "") ? filters.year : undefined;
  const company = await getCompany(Number(id), year);
  const movieFilters: Record<string, string> = { with_companies: id, sort_by: "popularity.desc", ...(year ? { "primary_release_date.gte": `${year}-01-01`, "primary_release_date.lte": `${year}-12-31` } : {}) };
  const showFilters: Record<string, string> = { with_companies: id, sort_by: "popularity.desc", ...(year ? { "first_air_date.gte": `${year}-01-01`, "first_air_date.lte": `${year}-12-31` } : {}) };
  const showMovies = filters.kind !== "show"; const showSeries = filters.kind !== "movie";
  const [ratedMovies, ratedShows] = await Promise.all([withCommunityRatings(company.movies.items), withCommunityRatings(company.shows.items)]);
  return <main className="page"><div className="shell"><section className="company-hero"><div className="company-logo">{company.logoPath ? <Image src={imageUrl(company.logoPath, "w500")!} width={360} height={180} alt={`${company.name} logo`} /> : <Building2 size={55} />}</div><div><div className="eyebrow">Production company</div><h1 className="display page-title">{company.name}</h1>{company.headquarters && <p className="entity-meta"><MapPin size={14} /> {company.headquarters}</p>}<p className="overview">{company.description || `Browse movies and series produced by ${company.name}.`}</p></div></section>
    <div className="section-head"><div><div className="eyebrow">Produced by {company.name}</div><h2 className="display">Catalog</h2></div></div><form className="recommendation-filter entity-filters"><select className="select" name="kind" defaultValue={filters.kind ?? ""}><option value="">Movies & series</option><option value="movie">Movies</option><option value="show">Series</option></select><input className="input" name="year" maxLength={4} inputMode="numeric" pattern="[0-9]{4}" placeholder="Release year" defaultValue={year} /><button className="button accent">Filter</button></form>
    {showMovies && <section className="section compact-section"><div className="section-head"><h2 className="display">Movies</h2></div><InfiniteMediaGrid initialItems={ratedMovies} initialPage={company.movies.page} totalPages={company.movies.totalPages} kind="movie" filters={movieFilters} /></section>}
    {showSeries && <section className="section compact-section"><div className="section-head"><h2 className="display">Series</h2></div><InfiniteMediaGrid initialItems={ratedShows} initialPage={company.shows.page} totalPages={company.shows.totalPages} kind="show" filters={showFilters} /></section>}
  </div></main>;
}

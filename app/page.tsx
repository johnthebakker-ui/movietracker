import { ConfigNotice } from "@/components/config-notice";
import { HomeHeroCarousel } from "@/components/home-hero-carousel";
import { MediaSection } from "@/components/media-section";
import { hasTmdb } from "@/lib/env";
import { discover, getTrending } from "@/lib/tmdb";

export default async function Home() {
  if (!hasTmdb) return <main className="page"><div className="shell"><ConfigNotice service="TMDB" /></div></main>;
  const [trending, movies, shows] = await Promise.all([
    getTrending(), discover("movie", { "primary_release_date.gte": new Date().toISOString().slice(0, 10) }), discover("show", { "first_air_date.gte": new Date().toISOString().slice(0, 10) })
  ]);
  return <main className="page">
    <div className="shell">
      <HomeHeroCarousel items={trending.filter(item => item.backdropPath).slice(0, 6)} />
      <MediaSection eyebrow="Everyone is watching" title="Trending now" items={trending} href="/discover?sort=popularity.desc" />
      <MediaSection eyebrow="Fresh from the cinema" title="New & upcoming films" items={movies.items} href="/discover?kind=movie&sort=primary_release_date.desc" />
      <MediaSection eyebrow="Stories worth settling into" title="Series premieres" items={shows.items} href="/discover?kind=show&sort=first_air_date.desc" />
    </div>
  </main>;
}

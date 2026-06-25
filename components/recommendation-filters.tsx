"use client";

import { CalendarDays, Clapperboard, Globe2, SlidersHorizontal } from "lucide-react";
import { ChoiceMenu, countryChoices } from "@/components/discovery-filters";
import type { Genre } from "@/lib/types";

type Params = { kind?: string; genre?: string; country?: string; year?: string; hideWatched?: string; hideListed?: string; hideAnimation?: string; shuffle?: string };

export function RecommendationFilters({ genres, params }: { genres: Genre[]; params: Params }) {
  const genreChoices = [...genres.map(genre => ({ value: String(genre.id), label: genre.name })), { value: "kdrama", label: "K-Drama" }].sort((a, b) => a.label.localeCompare(b.label));
  return <form className="discovery-filter-card recommendation-filter-card">
    <div className="discovery-filter-grid recommendation-filter-grid">
      <ChoiceMenu label="Format" icon={<Clapperboard size={17} />} name="kind" value={params.kind ?? ""} choices={[{ value: "", label: "Movies & series" }, { value: "movie", label: "Movies" }, { value: "show", label: "Series" }]} />
      <ChoiceMenu label="Genre" icon={<SlidersHorizontal size={17} />} name="genre" value={params.genre ?? ""} choices={[{ value: "", label: "Every genre" }, ...genreChoices]} />
      <ChoiceMenu label="Country" icon={<Globe2 size={17} />} name="country" value={params.country ?? ""} choices={countryChoices} />
    </div>
    <div className="year-filter-row recommendation-year-row">
      <div className="year-filter-heading"><CalendarDays size={17} /><span className="muted">Release year</span></div>
      <div className="year-fields exact"><input className="year-input" name="year" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="e.g. 2024" defaultValue={params.year} /></div>
      {params.shuffle && <input type="hidden" name="shuffle" value={params.shuffle} />}
      <div className="recommendation-filter-toggles"><label className="filter-checkbox"><input type="hidden" name="hideWatched" value="0" /><input name="hideWatched" value="1" type="checkbox" defaultChecked={params.hideWatched !== "0"} /> Hide watched</label><label className="filter-checkbox"><input type="hidden" name="hideListed" value="0" /><input name="hideListed" value="1" type="checkbox" defaultChecked={params.hideListed !== "0"} /> Hide titles in my lists</label><label className="filter-checkbox"><input type="hidden" name="hideAnimation" value="0" /><input name="hideAnimation" value="1" type="checkbox" defaultChecked={params.hideAnimation === "1"} /> Hide anime / cartoons</label></div>
      <button className="button accent">Update</button>
    </div>
  </form>;
}

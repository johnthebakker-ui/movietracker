"use client";

import { CalendarDays, Check, ChevronDown, Film, Gauge, SlidersHorizontal, Tv } from "lucide-react";
import type { Genre, MediaKind } from "@/lib/types";
import { useState } from "react";

function ChoiceMenu({ label, icon, name, value, choices }: { label: string; icon: React.ReactNode; name: string; value: string; choices: { value: string; label: string }[] }) {
  const [selectedValue, setSelectedValue] = useState(value); const selected = choices.find(choice => choice.value === selectedValue)?.label ?? choices[0]?.label;
  return <details className="filter-popover"><summary><span className="filter-summary-icon">{icon}</span><span><small>{label}</small><strong>{selected}</strong></span><ChevronDown size={15} /></summary><div className="filter-menu" role="group" aria-label={label}>{choices.map(choice => <label className="filter-option" key={choice.value}><input type="radio" name={name} value={choice.value} checked={choice.value === selectedValue} onChange={event => { setSelectedValue(choice.value); event.currentTarget.closest("details")?.removeAttribute("open"); }} /><span>{choice.label}</span>{choice.value === selectedValue && <Check size={14} />}</label>)}</div></details>;
}

export function DiscoveryFilters({ kind, genres, params }: { kind: MediaKind; genres: Genre[]; params: Record<string, string | undefined> }) {
  const [yearMode, setYearMode] = useState(params.yearMode === "range" ? "range" : "exact");
  return <form className="discovery-filter-card">
    <div className="discovery-filter-grid">
      <ChoiceMenu label="Format" icon={kind === "movie" ? <Film size={17} /> : <Tv size={17} />} name="kind" value={kind} choices={[{ value: "movie", label: "Movies" }, { value: "show", label: "Series" }]} />
      <ChoiceMenu label="Genre" icon={<SlidersHorizontal size={17} />} name="genre" value={params.genre ?? ""} choices={[{ value: "", label: "Every genre" }, ...genres.map(g => ({ value: String(g.id), label: g.name }))]} />
      <ChoiceMenu label="Rating" icon={<Gauge size={17} />} name="rating" value={params.rating ?? ""} choices={[{ value: "", label: "Any rating" }, { value: "6", label: "6.0 and above" }, { value: "7", label: "7.0 and above" }, { value: "8", label: "8.0 and above" }]} />
      <ChoiceMenu label="Sort by" icon={<ChevronDown size={17} />} name="sort" value={params.sort ?? "popularity.desc"} choices={[{ value: "popularity.desc", label: "Most popular" }, { value: "vote_average.desc", label: "Highest rated" }, { value: kind === "movie" ? "primary_release_date.desc" : "first_air_date.desc", label: "Newest releases" }]} />
    </div>
    <div className="year-filter-row"><div className="year-filter-heading"><CalendarDays size={17} /><span className="muted">Release year</span></div><div className="year-mode"><label><input type="radio" name="yearMode" value="exact" checked={yearMode === "exact"} onChange={() => setYearMode("exact")} /> Exact year</label><label><input type="radio" name="yearMode" value="range" checked={yearMode === "range"} onChange={() => setYearMode("range")} /> Range</label></div><div className={`year-fields ${yearMode}`}>{yearMode === "exact" ? <input className="year-input" name="year" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} placeholder="e.g. 2024" defaultValue={params.year} /> : <><input className="year-input" name="fromYear" inputMode="numeric" pattern="[0-9]{4}" placeholder="From" defaultValue={params.fromYear} /><span className="muted">to</span><input className="year-input" name="toYear" inputMode="numeric" pattern="[0-9]{4}" placeholder="To" defaultValue={params.toYear} /></>}</div><button className="button accent" type="submit">Show results</button></div>
  </form>;
}

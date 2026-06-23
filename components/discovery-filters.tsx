"use client";

import { CalendarDays, Check, ChevronDown, Clapperboard, Film, Gauge, Globe2, SlidersHorizontal, Tv } from "lucide-react";
import type { Genre } from "@/lib/types";
import type { DiscoveryFormat } from "@/lib/catalog-discovery";
import { useEffect, useId, useRef, useState } from "react";

const filterMenuEvent = "movietracker:filter-menu-open";

export const countryChoices = [
  { value: "", label: "Every country" }, { value: "US", label: "United States" }, { value: "GB", label: "United Kingdom" },
  { value: "KR", label: "South Korea" }, { value: "JP", label: "Japan" }, { value: "IN", label: "India" },
  { value: "CA", label: "Canada" }, { value: "AU", label: "Australia" }, { value: "FR", label: "France" },
  { value: "DE", label: "Germany" }, { value: "ES", label: "Spain" }, { value: "IT", label: "Italy" },
  { value: "CN", label: "China" }, { value: "TW", label: "Taiwan" }, { value: "TH", label: "Thailand" }, { value: "TR", label: "Türkiye" }
];

export function ChoiceMenu({ label, icon, name, value, choices }: { label: string; icon: React.ReactNode; name: string; value: string; choices: { value: string; label: string }[] }) {
  const [selectedValue, setSelectedValue] = useState(value); const selected = choices.find(choice => choice.value === selectedValue)?.label ?? choices[0]?.label;
  const menuId = useId(); const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => { const closeOther = (event: Event) => { if ((event as CustomEvent<string>).detail !== menuId && detailsRef.current) detailsRef.current.open = false; }; window.addEventListener(filterMenuEvent, closeOther); return () => window.removeEventListener(filterMenuEvent, closeOther); }, [menuId]);
  return <details ref={detailsRef} className="filter-popover" onToggle={() => { if (detailsRef.current?.open) window.dispatchEvent(new CustomEvent(filterMenuEvent, { detail: menuId })); }}><summary><span className="filter-summary-icon">{icon}</span><span><small>{label}</small><strong>{selected}</strong></span><ChevronDown size={15} /></summary><div className="filter-menu" role="group" aria-label={label}>{choices.map(choice => <label className="filter-option" key={choice.value}><input type="radio" name={name} value={choice.value} checked={choice.value === selectedValue} onChange={() => { setSelectedValue(choice.value); if (detailsRef.current) detailsRef.current.open = false; }} /><span>{choice.label}</span>{choice.value === selectedValue && <Check size={14} />}</label>)}</div></details>;
}

export function DiscoveryFilters({ kind, genres, params }: { kind: DiscoveryFormat; genres: Genre[]; params: Record<string, string | undefined> }) {
  const [yearMode, setYearMode] = useState(params.yearMode === "range" ? "range" : "exact");
  const genreChoices = [...genres.map(g => ({ value: String(g.id), label: g.name })), { value: "kdrama", label: "K-Drama" }].sort((a, b) => a.label.localeCompare(b.label));
  const formatIcon = kind === "movie" ? <Film size={17} /> : kind === "show" ? <Tv size={17} /> : <Clapperboard size={17} />;
  const normalizedSort = params.sort?.includes("vote_average") ? "rating" : params.sort?.includes("release_date") || params.sort?.includes("air_date") ? "newest" : params.sort ?? "popularity";
  return <form className="discovery-filter-card">
    {params.view && <input type="hidden" name="view" value={params.view} />}
    <div className="discovery-filter-grid">
      <ChoiceMenu label="Format" icon={formatIcon} name="kind" value={kind} choices={[{ value: "all", label: "Movies & series" }, { value: "movie", label: "Movies" }, { value: "show", label: "Series" }]} />
      <ChoiceMenu label="Genre" icon={<SlidersHorizontal size={17} />} name="genre" value={params.genre ?? ""} choices={[{ value: "", label: "Every genre" }, ...genreChoices]} />
      <ChoiceMenu label="Country" icon={<Globe2 size={17} />} name="country" value={params.genre === "kdrama" ? "KR" : params.country ?? ""} choices={countryChoices} />
      <ChoiceMenu label="Rating" icon={<Gauge size={17} />} name="rating" value={params.rating ?? ""} choices={[{ value: "", label: "Any rating" }, { value: "6", label: "6.0 and above" }, { value: "7", label: "7.0 and above" }, { value: "8", label: "8.0 and above" }]} />
      <ChoiceMenu label="Sort by" icon={<ChevronDown size={17} />} name="sort" value={normalizedSort} choices={[{ value: "popularity", label: "Most popular" }, { value: "rating", label: "Highest rated" }, { value: "newest", label: "Newest releases" }]} />
    </div>
    <div className="year-filter-row"><div className="year-filter-heading"><CalendarDays size={17} /><span className="muted">Release year</span></div><div className="year-mode"><label><input type="radio" name="yearMode" value="exact" checked={yearMode === "exact"} onChange={() => setYearMode("exact")} /> Exact year</label><label><input type="radio" name="yearMode" value="range" checked={yearMode === "range"} onChange={() => setYearMode("range")} /> Range</label></div><div className={`year-fields ${yearMode}`}>{yearMode === "exact" ? <input className="year-input" name="year" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} placeholder="e.g. 2024" defaultValue={params.year} /> : <><input className="year-input" name="fromYear" inputMode="numeric" pattern="[0-9]{4}" placeholder="From" defaultValue={params.fromYear} /><span className="muted">to</span><input className="year-input" name="toYear" inputMode="numeric" pattern="[0-9]{4}" placeholder="To" defaultValue={params.toYear} /></>}</div><button className="button accent" type="submit">Show results</button></div>
  </form>;
}

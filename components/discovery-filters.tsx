"use client";

import { Ban, CalendarDays, Check, ChevronDown, Clapperboard, Film, Gauge, Globe2, SlidersHorizontal, Tv, X } from "lucide-react";
import type { Genre } from "@/lib/types";
import type { DiscoveryFormat } from "@/lib/catalog-discovery";
import { useEffect, useId, useRef, useState } from "react";
import { ANIME_EXCLUDE_KEY, ANIMATION_GENRE_ID, SUPERHERO_GENRE_KEY, parseExcludedGenres } from "@/lib/genre-utils";

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
  useEffect(() => { const closeOutside = (event: PointerEvent) => { if (detailsRef.current?.open && !detailsRef.current.contains(event.target as Node)) detailsRef.current.open = false; }; document.addEventListener("pointerdown", closeOutside); return () => document.removeEventListener("pointerdown", closeOutside); }, []);
  return <details ref={detailsRef} className="filter-popover" onToggle={() => { if (detailsRef.current?.open) window.dispatchEvent(new CustomEvent(filterMenuEvent, { detail: menuId })); }}><summary><span className="filter-summary-icon">{icon}</span><span><small>{label}</small><strong>{selected}</strong></span><ChevronDown size={15} /></summary><div className="filter-menu" role="group" aria-label={label}><div className="filter-sheet-heading" aria-hidden="true"><span /><strong>{label}</strong></div>{choices.map(choice => <label className={`filter-option${choice.value === selectedValue ? " selected" : ""}`} key={choice.value}><input type="radio" name={name} value={choice.value} checked={choice.value === selectedValue} onChange={() => { setSelectedValue(choice.value); if (detailsRef.current) detailsRef.current.open = false; }} /><span>{choice.label}</span><span className="filter-option-check">{choice.value === selectedValue && <Check size={16} />}</span></label>)}</div></details>;
}

export function ExcludeGenreMenu({ genres, value, legacyHideAnimation }: { genres: Genre[]; value?: string; legacyHideAnimation?: boolean }) {
  const [selected, setSelected] = useState(() => {
    const values = parseExcludedGenres(value);
    if (legacyHideAnimation && !values.includes(String(ANIMATION_GENRE_ID))) values.push(String(ANIMATION_GENRE_ID));
    return values;
  });
  const menuId = useId(); const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => { const closeOther = (event: Event) => { if ((event as CustomEvent<string>).detail !== menuId && detailsRef.current) detailsRef.current.open = false; }; window.addEventListener(filterMenuEvent, closeOther); return () => window.removeEventListener(filterMenuEvent, closeOther); }, [menuId]);
  useEffect(() => { const closeOutside = (event: PointerEvent) => { if (detailsRef.current?.open && !detailsRef.current.contains(event.target as Node)) detailsRef.current.open = false; }; document.addEventListener("pointerdown", closeOutside); return () => document.removeEventListener("pointerdown", closeOutside); }, []);
  const choices = [
    { value: ANIME_EXCLUDE_KEY, label: "Anime" },
    { value: String(ANIMATION_GENRE_ID), label: "Animation / cartoons" },
    { value: SUPERHERO_GENRE_KEY, label: "Superhero" },
    ...genres.filter(genre => Number(genre.id) !== ANIMATION_GENRE_ID).map(genre => ({ value: String(genre.id), label: genre.name }))
  ].sort((a, b) => a.label.localeCompare(b.label));
  const toggle = (value: string) => setSelected(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  const label = selected.length ? `${selected.length} excluded` : "Exclude genres";
  return <details ref={detailsRef} className="filter-popover exclude-genre-popover" onToggle={() => { if (detailsRef.current?.open) window.dispatchEvent(new CustomEvent(filterMenuEvent, { detail: menuId })); }}>
    <input type="hidden" name="excludeGenres" value={selected.join(",")} />
    <summary><span className="filter-summary-icon"><Ban size={17} /></span><span><small>Exclude</small><strong>{label}</strong></span><ChevronDown size={15} /></summary>
    <div className="filter-menu exclude-genre-menu" role="group" aria-label="Exclude genres">
      <div className="filter-sheet-heading" aria-hidden="true"><span /><strong>Exclude genres</strong></div>
      <div className="exclude-options">{choices.map(choice => {
        const isSelected = selected.includes(choice.value);
        return <button
          className={`filter-option${isSelected ? " selected" : ""}`}
          key={choice.value}
          type="button"
          role="checkbox"
          aria-checked={isSelected}
          onPointerDown={event => event.preventDefault()}
          onClick={() => toggle(choice.value)}
        >
          <span>{choice.label}</span><span className="filter-option-check">{isSelected && <Check size={16} />}</span>
        </button>;
      })}</div>
      <div className="exclude-clear-footer"><button className="exclude-clear" type="button" disabled={!selected.length} onPointerDown={event => event.preventDefault()} onClick={() => setSelected([])}><X size={14} /> Clear excluded genres</button></div>
    </div>
  </details>;
}

export function DiscoveryFilters({ kind, genres, params }: { kind: DiscoveryFormat; genres: Genre[]; params: Record<string, string | undefined> }) {
  const [yearMode, setYearMode] = useState(params.yearMode === "range" ? "range" : "exact");
  const genreChoices = [...genres.map(g => ({ value: String(g.id), label: g.name })), { value: "kdrama", label: "K-Drama" }, { value: SUPERHERO_GENRE_KEY, label: "Superhero" }].sort((a, b) => a.label.localeCompare(b.label));
  const formatIcon = kind === "movie" ? <Film size={17} /> : kind === "show" ? <Tv size={17} /> : <Clapperboard size={17} />;
  const normalizedSort = params.sort?.includes("vote_average") ? "rating" : params.sort?.includes("release_date") || params.sort?.includes("air_date") ? "newest" : params.sort ?? "popularity";
  return <form className="discovery-filter-card">
    {params.view && <input type="hidden" name="view" value={params.view} />}
    <div className="discovery-filter-grid">
      <ChoiceMenu label="Format" icon={formatIcon} name="kind" value={kind} choices={[{ value: "all", label: "Movies & series" }, { value: "movie", label: "Movies" }, { value: "show", label: "Series" }]} />
      <ChoiceMenu label="Genre" icon={<SlidersHorizontal size={17} />} name="genre" value={params.genre ?? ""} choices={[{ value: "", label: "Every genre" }, ...genreChoices]} />
      <ChoiceMenu label="Country" icon={<Globe2 size={17} />} name="country" value={params.country ?? ""} choices={countryChoices} />
      <ChoiceMenu label="Rating" icon={<Gauge size={17} />} name="rating" value={params.rating ?? ""} choices={[{ value: "", label: "Any rating" }, { value: "6", label: "6.0 and above" }, { value: "7", label: "7.0 and above" }, { value: "8", label: "8.0 and above" }]} />
      <ChoiceMenu label="Sort by" icon={<ChevronDown size={17} />} name="sort" value={normalizedSort} choices={[{ value: "popularity", label: "Most popular" }, { value: "rating", label: "Highest rated" }, { value: "newest", label: "Newest releases" }]} />
      <ExcludeGenreMenu genres={genres} value={params.excludeGenres} legacyHideAnimation={params.hideAnimation === "1"} />
    </div>
    <div className="year-filter-row"><div className="year-filter-heading"><CalendarDays size={17} /><span className="muted">Release year</span></div><div className="year-mode"><label><input type="radio" name="yearMode" value="exact" checked={yearMode === "exact"} onChange={() => setYearMode("exact")} /> Exact year</label><label><input type="radio" name="yearMode" value="range" checked={yearMode === "range"} onChange={() => setYearMode("range")} /> Range</label></div><div className={`year-fields ${yearMode}`}>{yearMode === "exact" ? <input className="year-input" name="year" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} placeholder="e.g. 2024" defaultValue={params.year} /> : <><input className="year-input" name="fromYear" inputMode="numeric" pattern="[0-9]{4}" placeholder="From" defaultValue={params.fromYear} /><span className="muted">to</span><input className="year-input" name="toYear" inputMode="numeric" pattern="[0-9]{4}" placeholder="To" defaultValue={params.toYear} /></>}</div><button className="button accent" type="submit">Show results</button></div>
    <div className="recommendation-filter-toggles discovery-filter-toggles">
      <label className="filter-checkbox"><input type="hidden" name="hideWatched" value="0" /><input type="checkbox" name="hideWatched" value="1" defaultChecked={params.hideWatched === "1" || params.hideWatched === "on"} /> Hide watched</label>
      <label className="filter-checkbox"><input type="hidden" name="hideListed" value="0" /><input type="checkbox" name="hideListed" value="1" defaultChecked={params.hideListed === "1" || params.hideListed === "on"} /> Hide titles in my lists</label>
    </div>
  </form>;
}

"use client";

import { CalendarClock, CalendarDays, Check, CircleHelp, Clock3 } from "lucide-react";
import { useRef } from "react";
import { bulkWatchEpisodes, markWholeShowWatched } from "@/app/actions/library";

type Props = { mediaId: number; episodeIds?: number[]; episodeDates?: Record<string, string | null>; tmdbId?: number; path: string; label: string; scope: "season" | "show" };

export function BulkWatchLogForm({ mediaId, episodeIds = [], episodeDates = {}, tmdbId, path, label, scope }: Props) {
  const timezoneOffset = useRef<HTMLInputElement>(null); const action = scope === "show" ? markWholeShowWatched : bulkWatchEpisodes;
  const hidden = <><input type="hidden" name="mediaId" value={mediaId} />{tmdbId && <input type="hidden" name="tmdbId" value={tmdbId} />}<input type="hidden" name="episodeIds" value={episodeIds.join(",")} /><input type="hidden" name="episodeDates" value={JSON.stringify(episodeDates)} /><input type="hidden" name="path" value={path} /></>;
  const hasReleaseDates = scope === "show" || Object.values(episodeDates).some(Boolean);
  return <details className="watch-log-menu bulk-watch-menu"><summary className="button ghost"><Check size={16} /> {label}</summary><div className="watch-date-panel">
    <div className="watch-date-heading"><strong>Choose the watch date</strong><span>This applies to every newly watched episode.</span></div>
    <div className="watch-date-quick">
      <form action={action}>{hidden}<input type="hidden" name="dateMode" value="now" /><button><Clock3 size={15} /><span>Right now<small>Current date</small></span></button></form>
      {hasReleaseDates && <form action={action}>{hidden}<input type="hidden" name="dateMode" value="release" /><button><CalendarDays size={15} /><span>Release dates<small>Each episode’s air date</small></span></button></form>}
      <form action={action}>{hidden}<input type="hidden" name="dateMode" value="unknown" /><button><CircleHelp size={15} /><span>Dates unknown<small>No calendar entries</small></span></button></form>
    </div>
    <form className="watch-custom-date" action={action} onSubmit={() => { if (timezoneOffset.current) timezoneOffset.current.value = String(new Date().getTimezoneOffset()); }}>{hidden}<input type="hidden" name="dateMode" value="custom" /><input ref={timezoneOffset} type="hidden" name="timezoneOffset" defaultValue="0" /><label><span>Or use one custom date</span><input className="input" type="datetime-local" name="watchedAt" required /></label><button className="button small accent"><CalendarClock size={14} /> Save all</button></form>
  </div></details>;
}

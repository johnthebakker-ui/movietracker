"use client";

import { CalendarClock, CalendarDays, Check, CircleHelp, Clock3, Trash2 } from "lucide-react";
import { useRef } from "react";
import { addWatch, removeTargetWatches } from "@/app/actions/library";

export function WatchLogForm({ mediaId, episodeId, releaseDate, path, watched = false }: { mediaId: number; episodeId?: number | null; releaseDate?: string | null; path: string; watched?: boolean }) {
  const timezoneOffset = useRef<HTMLInputElement>(null);
  const hidden = <><input type="hidden" name="mediaId" value={mediaId} />{episodeId && <input type="hidden" name="episodeId" value={episodeId} />}<input type="hidden" name="path" value={path} /></>;
  return <details className="watch-log-menu"><summary className="button ghost"><CalendarClock size={16} /> {watched ? "Add another watch" : "Mark watched"}</summary><div className="watch-date-panel">
    <div className="watch-date-heading"><strong>When did you watch it?</strong><span>Unknown dates count everywhere except your calendar.</span></div>
    <div className="watch-date-quick">
      <form action={addWatch}>{hidden}<input type="hidden" name="dateMode" value="now" /><button><Clock3 size={15} /><span>Right now<small>Use the current date</small></span></button></form>
      {releaseDate && <form action={addWatch}>{hidden}<input type="hidden" name="dateMode" value="release" /><input type="hidden" name="releaseDate" value={releaseDate} /><button><CalendarDays size={15} /><span>Release date<small>{releaseDate}</small></span></button></form>}
      <form action={addWatch}>{hidden}<input type="hidden" name="dateMode" value="unknown" /><button><CircleHelp size={15} /><span>Date unknown<small>No calendar entry</small></span></button></form>
    </div>
    <form className="watch-custom-date" action={addWatch} onSubmit={() => { if (timezoneOffset.current) timezoneOffset.current.value = String(new Date().getTimezoneOffset()); }}>{hidden}<input type="hidden" name="dateMode" value="custom" /><input ref={timezoneOffset} type="hidden" name="timezoneOffset" defaultValue="0" /><label><span>Or choose a date and time</span><input className="input" type="datetime-local" name="watchedAt" required /></label><button className="button small accent"><Check size={14} /> Save</button></form>
    {watched && <form className="remove-watch-form" action={removeTargetWatches}>{hidden}<button><Trash2 size={14} /> Remove watched status{episodeId ? " from this episode" : ""}</button></form>}
  </div></details>;
}

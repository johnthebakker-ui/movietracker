"use client";

import { CalendarClock, CalendarDays, Check, CircleHelp, Clock3, Trash2 } from "lucide-react";
import { useActionState, useRef } from "react";
import { addWatch, removeTargetWatches } from "@/app/actions/library";

type WatchActionState = { message: string };

export function WatchLogForm({ mediaId, episodeId, releaseDate, path, watched = false }: { mediaId: number; episodeId?: number | null; releaseDate?: string | null; path: string; watched?: boolean }) {
  const timezoneOffset = useRef<HTMLInputElement>(null);
  async function saveWatch(_previous: WatchActionState, form: FormData): Promise<WatchActionState> {
    await addWatch(form);
    const mode = String(form.get("dateMode"));
    return { message: mode === "release" ? "Added using the release date." : mode === "unknown" ? "Added with no calendar date." : "Watch added." };
  }
  const [state, watchAction, pending] = useActionState(saveWatch, { message: "" });
  const hidden = <><input type="hidden" name="mediaId" value={mediaId} />{episodeId && <input type="hidden" name="episodeId" value={episodeId} />}<input type="hidden" name="path" value={path} /></>;
  return <details className="watch-log-menu"><summary className="button ghost"><CalendarClock size={16} /> {watched ? "Add another watch" : "Mark watched"}</summary><div className="watch-date-panel">
    <div className="watch-date-heading"><strong>When did you watch it?</strong><span>Unknown dates count everywhere except your calendar.</span></div>
    <div className="watch-date-quick">
      <form action={watchAction}>{hidden}<input type="hidden" name="dateMode" value="now" /><button disabled={pending}><Clock3 size={15} /><span>Right now<small>Use the current date</small></span></button></form>
      {releaseDate && <form action={watchAction} onSubmit={event => { if (!window.confirm(`Add this watch on its release date (${releaseDate})?`)) event.preventDefault(); }}>{hidden}<input type="hidden" name="dateMode" value="release" /><input type="hidden" name="releaseDate" value={releaseDate} /><button disabled={pending}><CalendarDays size={15} /><span>Release date<small>{releaseDate}</small></span></button></form>}
      <form action={watchAction} onSubmit={event => { if (!window.confirm("Add this watch without a date? It will count in history but not appear on your calendar.")) event.preventDefault(); }}>{hidden}<input type="hidden" name="dateMode" value="unknown" /><button disabled={pending}><CircleHelp size={15} /><span>Date unknown<small>No calendar entry</small></span></button></form>
    </div>
    <form className="watch-custom-date" action={addWatch} onSubmit={() => { if (timezoneOffset.current) timezoneOffset.current.value = String(new Date().getTimezoneOffset()); }}>{hidden}<input type="hidden" name="dateMode" value="custom" /><input ref={timezoneOffset} type="hidden" name="timezoneOffset" defaultValue="0" /><label><span>Or choose a date and time</span><input className="input" type="datetime-local" name="watchedAt" required /></label><button className="button small accent"><Check size={14} /> Save</button></form>
    {state.message && <div className="watch-date-status" role="status"><Check size={14} /> {state.message}</div>}
    {watched && <form className="remove-watch-form" action={removeTargetWatches}>{hidden}<button><Trash2 size={14} /> Remove watched status{episodeId ? " from this episode" : ""}</button></form>}
  </div></details>;
}

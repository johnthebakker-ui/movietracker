"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, ExternalLink, Heart, ListPlus, Trash2 } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { quickTrack, removeFromList, type ListActionState } from "@/app/actions/library";
import type { MediaSummary } from "@/lib/types";
import { imageUrl } from "@/lib/tmdb";
import { yearOf } from "@/lib/utils";

type ListContext = { id: string; mediaId: number; name: string };

export function MediaCard({ item, listContext }: { item: MediaSummary; listContext?: ListContext }) {
  const poster = imageUrl(item.posterPath, "w500");
  const [menu, setMenu] = useState(false);
  const [state, quickAction, pending] = useActionState(quickTrack, { status: "idle", message: "" } satisfies ListActionState);
  const [removeState, removeAction, removing] = useActionState(removeFromList, { status: "idle", message: "" } satisfies ListActionState);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const startHold = () => { held.current = false; holdTimer.current = setTimeout(() => { held.current = true; setMenu(true); }, 520); };
  const stopHold = () => { if (holdTimer.current) clearTimeout(holdTimer.current); };
  const hidden = <><input type="hidden" name="tmdbId" value={item.id} /><input type="hidden" name="kind" value={item.kind} /></>;
  return <article className="media-card interactive-card" onContextMenu={event => { event.preventDefault(); setMenu(true); }} onClickCapture={event => { if (held.current) { event.preventDefault(); event.stopPropagation(); held.current = false; } }} onPointerDown={event => { if (event.pointerType === "touch") startHold(); }} onPointerUp={stopHold} onPointerCancel={stopHold} onPointerLeave={stopHold}>
    <Link href={`/title/${item.kind}/${item.id}`}>
      <div className="poster-wrap">
        {poster ? <Image className="poster" src={poster} alt={`${item.title} poster`} fill sizes="(max-width: 720px) 50vw, 17vw" /> : <div className="poster-fallback">{item.title}</div>}
        {item.communityRating != null && <span className="card-badge" title={`${item.communityRatingCount ?? 0} MovieTracker ratings`}>{item.communityRating.toFixed(1)}<small>/10</small></span>}
      </div>
      <div className="card-title truncate">{item.title}</div>
      <div className="card-meta"><span>{yearOf(item.releaseDate)}</span><span>{item.kind === "show" ? "Series" : "Film"}</span></div>
    </Link>
    {menu && <><button className="context-scrim" aria-label="Close quick actions" onClick={() => setMenu(false)} /><div className="media-context-menu" role="menu">
      <strong>{item.title}</strong><small>Quick actions</small>
      <Link href={`/title/${item.kind}/${item.id}`}><ExternalLink size={15} /> Open details</Link>
      <form action={quickAction} className="quick-action-form">{hidden}<button name="intent" value="planned" disabled={pending}><ListPlus size={15} /> Add to watchlist</button><button name="intent" value="completed" disabled={pending}><Check size={15} /> Mark watched</button><button name="intent" value="favorite" disabled={pending}><Heart size={15} /> Add to favorites</button></form>
      {listContext && <form action={removeAction} className="quick-action-form" onSubmit={event => { if (!window.confirm(`Remove ${item.title} from ${listContext.name}?`)) event.preventDefault(); }}><input type="hidden" name="listId" value={listContext.id} /><input type="hidden" name="mediaId" value={listContext.mediaId} /><input type="hidden" name="path" value={`/lists/${listContext.id}`} /><button className="danger-action" disabled={removing}><Trash2 size={15} /> {removing ? "Removing…" : "Remove from this list"}</button></form>}
      {state.status !== "idle" && <span className={`quick-action-result ${state.status}`} role="status">{state.status === "success" ? "✓" : "!"} {state.message}</span>}
      {removeState.status !== "idle" && <span className={`quick-action-result ${removeState.status}`} role="status">{removeState.status === "success" ? "✓" : "!"} {removeState.message}</span>}
    </div></>}
  </article>;
}

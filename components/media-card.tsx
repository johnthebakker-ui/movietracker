"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, ExternalLink, Heart, ListPlus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { quickTrack, removeFromList, type ListActionState } from "@/app/actions/library";
import type { MediaSummary } from "@/lib/types";
import { imageUrl } from "@/lib/tmdb";
import { yearOf } from "@/lib/utils";

type ListContext = { id: string; mediaId: number; name: string };

const menuEvent = "movietracker:media-menu-open";

export function MediaCard({ item, listContext, progressLabel }: { item: MediaSummary; listContext?: ListContext; progressLabel?: string }) {
  const poster = imageUrl(item.posterPath, "w500");
  const menuId = useId();
  const [menu, setMenu] = useState(false);
  const [state, quickAction, pending] = useActionState(quickTrack, { status: "idle", message: "" } satisfies ListActionState);
  const [removeState, removeAction, removing] = useActionState(removeFromList, { status: "idle", message: "" } satisfies ListActionState);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const openMenu = () => { window.dispatchEvent(new CustomEvent(menuEvent, { detail: menuId })); setMenu(true); };
  const startHold = () => { held.current = false; holdTimer.current = setTimeout(() => { held.current = true; openMenu(); }, 520); };
  const stopHold = () => { if (holdTimer.current) clearTimeout(holdTimer.current); };
  useEffect(() => {
    const closeOther = (event: Event) => { if ((event as CustomEvent<string>).detail !== menuId) setMenu(false); };
    window.addEventListener(menuEvent, closeOther);
    return () => window.removeEventListener(menuEvent, closeOther);
  }, [menuId]);
  useEffect(() => {
    if (!menu) return;
    const closeOutside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(false); };
    const closeOnScroll = () => setMenu(false);
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnScroll);
    return () => { document.removeEventListener("pointerdown", closeOutside); window.removeEventListener("scroll", closeOnScroll, true); window.removeEventListener("resize", closeOnScroll); };
  }, [menu]);
  const hidden = <><input type="hidden" name="tmdbId" value={item.id} /><input type="hidden" name="kind" value={item.kind} /></>;
  return <article className="media-card interactive-card" onContextMenu={event => { event.preventDefault(); openMenu(); }} onClickCapture={event => { if (held.current) { event.preventDefault(); event.stopPropagation(); held.current = false; } }} onPointerDown={event => { if (event.pointerType === "touch") startHold(); }} onPointerUp={stopHold} onPointerCancel={stopHold} onPointerLeave={stopHold}>
    <Link href={`/title/${item.kind}/${item.id}`}>
      <div className="poster-wrap">
        {poster ? <Image className="poster" src={poster} alt={`${item.title} poster`} fill sizes="(max-width: 720px) 50vw, 17vw" /> : <div className="poster-fallback">{item.title}</div>}
        {item.communityRating != null && <span className="card-badge" title={`${item.communityRatingCount ?? 0} MovieTracker ratings`}>{item.communityRating.toFixed(1)}<small>/10</small></span>}
      </div>
      <div className="card-title truncate">{item.title}</div>
      <div className="card-meta"><span>{yearOf(item.releaseDate)}</span><span>{item.kind === "show" ? "Series" : "Film"}</span></div>
      {progressLabel && <div className="card-progress">{progressLabel}</div>}
    </Link>
    {menu && <div className="media-context-menu" role="menu" ref={menuRef}>
      <strong>{item.title}</strong><small>Quick actions</small>
      <Link href={`/title/${item.kind}/${item.id}`}><ExternalLink size={15} /> Open details</Link>
      <form action={quickAction} className="quick-action-form">{hidden}<button name="intent" value="planned" disabled={pending}><ListPlus size={15} /> Add to watchlist</button><button name="intent" value="completed" disabled={pending}><Check size={15} /> Mark watched</button><button name="intent" value="favorite" disabled={pending}><Heart size={15} /> Add to favorites</button></form>
      {listContext && <form action={removeAction} className="quick-action-form" onSubmit={event => { if (!window.confirm(`Remove ${item.title} from ${listContext.name}?`)) event.preventDefault(); }}><input type="hidden" name="listId" value={listContext.id} /><input type="hidden" name="mediaId" value={listContext.mediaId} /><input type="hidden" name="path" value={`/lists/${listContext.id}`} /><button className="danger-action" disabled={removing}><Trash2 size={15} /> {removing ? "Removing…" : "Remove from this list"}</button></form>}
      {state.status !== "idle" && <span className={`quick-action-result ${state.status}`} role="status">{state.status === "success" ? "✓" : "!"} {state.message}</span>}
      {removeState.status !== "idle" && <span className={`quick-action-result ${removeState.status}`} role="status">{removeState.status === "success" ? "✓" : "!"} {removeState.message}</span>}
    </div>}
  </article>;
}

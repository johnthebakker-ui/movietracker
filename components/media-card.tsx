"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, ExternalLink, Heart, ListPlus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { addCatalogTitleToList, quickTrack, removeFromList, type ListActionState } from "@/app/actions/library";
import type { MediaSummary } from "@/lib/types";
import { imageUrl } from "@/lib/tmdb";
import { yearOf } from "@/lib/utils";

type ListContext = { id: string; mediaId: number; name: string };
type UserList = { id: string; name: string };

const menuEvent = "movietracker:media-menu-open";

export function MediaCard({ item, listContext, progressLabel }: { item: MediaSummary; listContext?: ListContext; progressLabel?: string }) {
  const poster = imageUrl(item.posterPath, "w500");
  const menuId = useId();
  const [menu, setMenu] = useState(false);
  const [state, quickAction, pending] = useActionState(quickTrack, { status: "idle", message: "" } satisfies ListActionState);
  const [addState, addAction, adding] = useActionState(addCatalogTitleToList, { status: "idle", message: "" } satisfies ListActionState);
  const [removeState, removeAction, removing] = useActionState(removeFromList, { status: "idle", message: "" } satisfies ListActionState);
  const [lists, setLists] = useState<UserList[] | null>(null);
  const [listError, setListError] = useState("");
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
  useEffect(() => {
    if (!menu || lists !== null || listError) return;
    let active = true;
    fetch("/api/lists/mine").then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load your lists");
      if (active) setLists(result.lists ?? []);
    }).catch(error => { if (active) setListError(error instanceof Error ? error.message : "Could not load your lists"); });
    return () => { active = false; };
  }, [menu, lists, listError]);
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
      <div className="context-list-section"><span>Add to a custom list</span>{lists === null && !listError ? <small>Loading your lists…</small> : listError ? <Link href={listError.startsWith("Sign in") ? "/login" : "/lists"}>{listError}</Link> : lists?.length ? <form action={addAction} className="context-list-form">{hidden}<select name="listId" aria-label={`Choose a list for ${item.title}`} required defaultValue=""><option value="" disabled>Choose a list</option>{lists.map(list => <option value={list.id} key={list.id}>{list.name}</option>)}</select><button disabled={adding}><ListPlus size={15} /> {adding ? "Adding…" : "Add"}</button></form> : <Link href="/lists">Create your first list</Link>}</div>
      {listContext && <form action={removeAction} className="quick-action-form" onSubmit={event => { if (!window.confirm(`Remove ${item.title} from ${listContext.name}?`)) event.preventDefault(); }}><input type="hidden" name="listId" value={listContext.id} /><input type="hidden" name="mediaId" value={listContext.mediaId} /><input type="hidden" name="path" value={`/lists/${listContext.id}`} /><button className="danger-action" disabled={removing}><Trash2 size={15} /> {removing ? "Removing…" : "Remove from this list"}</button></form>}
      {state.status !== "idle" && <span className={`quick-action-result ${state.status}`} role="status">{state.status === "success" ? "✓" : "!"} {state.message}</span>}
      {addState.status !== "idle" && <span className={`quick-action-result ${addState.status}`} role="status">{addState.status === "success" ? "✓" : "!"} {addState.message}</span>}
      {removeState.status !== "idle" && <span className={`quick-action-result ${removeState.status}`} role="status">{removeState.status === "success" ? "✓" : "!"} {removeState.message}</span>}
    </div>}
  </article>;
}

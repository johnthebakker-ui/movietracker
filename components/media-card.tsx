"use client";

import Image from "@/components/app-image";
import Link from "next/link";
import { Check, ExternalLink, Heart, ListPlus, MoreVertical, Search, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { addCatalogTitleToList, quickTrack, removeCatalogTitleFromList, removeFromList, type ListActionState } from "@/app/actions/library";
import { RecommendationInterestButton } from "@/components/recommendation-interest-button";
import type { MediaSummary } from "@/lib/types";
import { imageUrl } from "@/lib/tmdb";
import { yearOf } from "@/lib/utils";

type ListContext = { id: string; mediaId: number; name: string };
type UserList = { id: string; name: string; contains: boolean };
type QuickState = { progressStatus: string | null; favorite: boolean; watched: boolean };
const menuEvent = "movietracker:media-menu-open";

export function MediaCard({ item, listContext, progressLabel, onNotInterested }: { item: MediaSummary; listContext?: ListContext; progressLabel?: string; onNotInterested?: () => void }) {
  const poster = imageUrl(item.posterPath, "w500"); const menuId = useId(); const cardRef = useRef<HTMLElement>(null); const menuRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false); const [position, setPosition] = useState({ top: 12, left: 12, maxHeight: 560 });
  const [lists, setLists] = useState<UserList[] | null>(null); const [quickState, setQuickState] = useState<QuickState>({ progressStatus: null, favorite: false, watched: false });
  const [listError, setListError] = useState(""); const [query, setQuery] = useState("");
  async function runQuick(previous: ListActionState, form: FormData) { const result = await quickTrack(previous, form); if (result.status === "success") { const intent = String(form.get("intent")); if (intent === "planned") setQuickState(value => ({ ...value, progressStatus: "planned" })); if (intent === "completed") setQuickState(value => ({ ...value, progressStatus: "completed", watched: true })); if (intent === "favorite") setQuickState(value => ({ ...value, favorite: true })); } return result; }
  async function runAdd(previous: ListActionState, form: FormData) { const result = await addCatalogTitleToList(previous, form); if (result.status === "success") { const listId = String(form.get("listId")); setLists(value => value?.map(list => list.id === listId ? { ...list, contains: true } : list) ?? value); } return result; }
  async function runListRemove(previous: ListActionState, form: FormData) { const result = await removeCatalogTitleFromList(previous, form); if (result.status === "success") { const listId = String(form.get("listId")); setLists(value => value?.map(list => list.id === listId ? { ...list, contains: false } : list) ?? value); } return result; }
  const [state, quickAction, pending] = useActionState(runQuick, { status: "idle", message: "" } satisfies ListActionState);
  const [addState, addAction, adding] = useActionState(runAdd, { status: "idle", message: "" } satisfies ListActionState);
  const [listRemoveState, listRemoveAction, removingFromChosenList] = useActionState(runListRemove, { status: "idle", message: "" } satisfies ListActionState);
  const [removeState, removeAction, removing] = useActionState(removeFromList, { status: "idle", message: "" } satisfies ListActionState);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null); const holdStart = useRef({ x: 0, y: 0 }); const held = useRef(false);
  const place = () => { const rect = cardRef.current?.getBoundingClientRect(); if (!rect) return; const width = Math.min(310, window.innerWidth - 24); const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)); const roomBelow = window.innerHeight - rect.top; const top = roomBelow >= 470 ? Math.max(12, rect.top) : Math.max(12, window.innerHeight - Math.min(560, window.innerHeight - 24) - 12); setPosition({ top, left, maxHeight: window.innerHeight - top - 12 }); };
  const clearHold = () => { if (holdTimer.current) clearTimeout(holdTimer.current); holdTimer.current = null; };
  const clearSelection = () => document.getSelection()?.removeAllRanges();
  const closeMenu = () => { clearHold(); held.current = false; clearSelection(); setMenu(false); };
  const openMenu = () => { clearHold(); clearSelection(); window.dispatchEvent(new CustomEvent(menuEvent, { detail: menuId })); place(); setMenu(true); };
  const startHold = (event: React.PointerEvent) => { clearHold(); clearSelection(); held.current = false; holdStart.current = { x: event.clientX, y: event.clientY }; holdTimer.current = setTimeout(() => { holdTimer.current = null; held.current = true; openMenu(); }, 380); };
  const stopHold = () => clearHold();
  useEffect(() => { const closeOther = (event: Event) => { if ((event as CustomEvent<string>).detail !== menuId) { clearHold(); held.current = false; setMenu(false); } }; window.addEventListener(menuEvent, closeOther); return () => window.removeEventListener(menuEvent, closeOther); }, [menuId]);
  useEffect(() => { if (!menu) return; const close = () => { if (holdTimer.current) clearTimeout(holdTimer.current); holdTimer.current = null; held.current = false; document.getSelection()?.removeAllRanges(); setMenu(false); }; const closeOutside = (event: PointerEvent) => { const target = event.target as Element; if (target.closest?.(".context-scrim")) return; if (!menuRef.current?.contains(target) && !cardRef.current?.contains(target)) close(); }; const esc = (event: KeyboardEvent) => { if (event.key === "Escape") close(); }; document.addEventListener("pointerdown", closeOutside); document.addEventListener("keydown", esc); window.addEventListener("resize", place); return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", esc); window.removeEventListener("resize", place); }; }, [menu]);
  useEffect(() => { if (!menu || window.innerWidth > 720) return; const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = previous; }; }, [menu]);
  useEffect(() => { if (!menu || lists !== null || listError) return; let active = true; fetch(`/api/lists/mine?kind=${item.kind}&tmdbId=${item.id}`).then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not load your lists"); if (active) { setLists(result.lists ?? []); setQuickState(result.state); } }).catch(error => { if (active) setListError(error instanceof Error ? error.message : "Could not load your lists"); }); return () => { active = false; }; }, [menu, lists, listError, item.id, item.kind]);
  const hidden = <><input type="hidden" name="tmdbId" value={item.id} /><input type="hidden" name="kind" value={item.kind} /></>;
  const filtered = (lists ?? []).filter(list => list.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const popup = menu && typeof document !== "undefined" ? createPortal(<><button className="context-scrim" type="button" aria-label="Close actions" onPointerDown={event => event.stopPropagation()} onClick={event => { event.preventDefault(); event.stopPropagation(); closeMenu(); }} /><div className="media-context-menu" role="menu" ref={menuRef} style={{ top: position.top, left: position.left, maxHeight: position.maxHeight }}>
    <div className="context-sheet-handle" aria-hidden="true" />
    <button className="context-sheet-close" type="button" onClick={closeMenu} aria-label="Close actions"><X size={18} /></button>
    <div className="context-menu-heading"><div className="context-menu-thumb">{poster ? <Image src={poster} alt="" fill sizes="48px" /> : <span>{item.title.slice(0, 1)}</span>}</div><div><strong>{item.title}</strong><small>{item.kind === "show" ? "Series" : "Movie"} actions</small></div></div>
    <div className="context-primary-actions">
      <Link href={`/title/${item.kind}/${item.id}`}><ExternalLink size={18} /> <span>Details</span></Link>
      <form action={quickAction} className="quick-action-form">{hidden}
        <button name="intent" value="planned" disabled={pending || quickState.progressStatus === "planned"}><ListPlus size={18} /> <span>{quickState.progressStatus === "planned" ? "In watchlist" : "Watchlist"}</span></button>
        <button name="intent" value="completed" disabled={pending || quickState.watched}><Check size={18} /> <span>{quickState.watched ? "Watched" : "Watched"}</span></button>
        <button name="intent" value="favorite" disabled={pending || quickState.favorite}><Heart size={18} /> <span>{quickState.favorite ? "Favorited" : "Favorite"}</span></button>
      </form>
    </div>
    <div className="context-list-section"><span>Custom lists</span>{lists === null && !listError ? <small>Loading your lists…</small> : listError ? <Link href={listError.startsWith("Sign in") ? "/login" : "/lists"}>{listError}</Link> : lists?.length ? <><label className="context-list-search"><Search size={14} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a list" aria-label="Find a list" /></label><div className="context-list-options">{filtered.map(list => list.contains ? <form action={listRemoveAction} key={list.id} onSubmit={event => { if (!window.confirm(`Remove ${item.title} from ${list.name}?`)) event.preventDefault(); }}>{hidden}<input type="hidden" name="listId" value={list.id} /><button disabled={removingFromChosenList} className="contained" title={`Remove from ${list.name}`}><span className="context-list-name">{list.name}</span><span className="context-list-action"><Check size={14} /> Added</span></button></form> : <form action={addAction} key={list.id}>{hidden}<input type="hidden" name="listId" value={list.id} /><button disabled={adding}><span className="context-list-name">{list.name}</span><span className="context-list-action"><ListPlus size={14} /> Add</span></button></form>)}</div></> : <Link href="/lists">Create your first list</Link>}</div>
    {listContext && <div className="context-remove-section"><span>Current list</span><form action={removeAction} onSubmit={event => { if (!window.confirm(`Remove ${item.title} from ${listContext.name}?`)) event.preventDefault(); }}><input type="hidden" name="listId" value={listContext.id} /><input type="hidden" name="mediaId" value={listContext.mediaId} /><input type="hidden" name="path" value={`/lists/${listContext.id}`} /><button className="danger-action" disabled={removing}><Trash2 size={15} /> {removing ? "Removing…" : `Remove from ${listContext.name}`}</button></form></div>}
    {onNotInterested && <div className="context-recommendation-section"><RecommendationInterestButton kind={item.kind} tmdbId={item.id} compact danger confirmTitle={item.title} onChange={dismissed => { if (dismissed) { closeMenu(); onNotInterested(); } }} /></div>}
    {[state, addState, listRemoveState, removeState].map((result, index) => result.status !== "idle" && <span className={`quick-action-result ${result.status}`} role="status" key={index}>{result.status === "success" ? "✓" : "!"} {result.message}</span>)}
  </div></>, document.body) : null;
  return <article ref={cardRef} className="media-card interactive-card" onContextMenu={event => { event.preventDefault(); clearSelection(); openMenu(); }} onClickCapture={event => { if (held.current) { event.preventDefault(); event.stopPropagation(); held.current = false; } }} onDragStart={event => event.preventDefault()} onPointerDown={event => { if (event.pointerType === "touch") startHold(event); }} onPointerMove={event => { if (event.pointerType === "touch" && holdTimer.current && Math.hypot(event.clientX - holdStart.current.x, event.clientY - holdStart.current.y) > 9) stopHold(); }} onPointerUp={stopHold} onPointerCancel={stopHold} onPointerLeave={stopHold}>
    <Link prefetch={false} href={`/title/${item.kind}/${item.id}`}><div className="poster-wrap">{poster ? <Image className="poster" src={poster} alt={`${item.title} poster`} fill sizes="(max-width: 720px) 50vw, 17vw" /> : <div className="poster-fallback">{item.title}</div>}{item.communityRating != null && <span className="card-badge" title={`${item.communityRatingCount ?? 0} MovieTracker ratings`}>{item.communityRating.toFixed(1)}<small>/10</small></span>}</div><div className="card-title truncate">{item.title}</div><div className="card-meta"><span>{yearOf(item.releaseDate)}</span><span>{item.kind === "show" ? "Series" : "Film"}</span></div>{progressLabel && <div className="card-progress">{progressLabel}</div>}</Link>
    <button className="card-menu-trigger" type="button" onClick={event => { event.preventDefault(); openMenu(); }} aria-label={`Actions for ${item.title}`} aria-haspopup="menu"><MoreVertical size={16} /></button>{popup}
  </article>;
}

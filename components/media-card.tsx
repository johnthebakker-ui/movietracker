"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, ExternalLink, Heart, ListPlus, MoreVertical, Search, Trash2 } from "lucide-react";
import { createPortal } from "react-dom";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { addCatalogTitleToList, quickTrack, removeCatalogTitleFromList, removeFromList, type ListActionState } from "@/app/actions/library";
import type { MediaSummary } from "@/lib/types";
import { imageUrl } from "@/lib/tmdb";
import { yearOf } from "@/lib/utils";

type ListContext = { id: string; mediaId: number; name: string };
type UserList = { id: string; name: string; contains: boolean };
type QuickState = { progressStatus: string | null; favorite: boolean; watched: boolean };
const menuEvent = "movietracker:media-menu-open";

export function MediaCard({ item, listContext, progressLabel }: { item: MediaSummary; listContext?: ListContext; progressLabel?: string }) {
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
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null); const held = useRef(false);
  const place = () => { const rect = cardRef.current?.getBoundingClientRect(); if (!rect) return; const width = Math.min(310, window.innerWidth - 24); const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)); const roomBelow = window.innerHeight - rect.top; const top = roomBelow >= 470 ? Math.max(12, rect.top) : Math.max(12, window.innerHeight - Math.min(560, window.innerHeight - 24) - 12); setPosition({ top, left, maxHeight: window.innerHeight - top - 12 }); };
  const openMenu = () => { window.dispatchEvent(new CustomEvent(menuEvent, { detail: menuId })); place(); setMenu(true); };
  const startHold = () => { held.current = false; holdTimer.current = setTimeout(() => { held.current = true; openMenu(); }, 520); };
  const stopHold = () => { if (holdTimer.current) clearTimeout(holdTimer.current); };
  useEffect(() => { const closeOther = (event: Event) => { if ((event as CustomEvent<string>).detail !== menuId) setMenu(false); }; window.addEventListener(menuEvent, closeOther); return () => window.removeEventListener(menuEvent, closeOther); }, [menuId]);
  useEffect(() => { if (!menu) return; const closeOutside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node) && !cardRef.current?.contains(event.target as Node)) setMenu(false); }; const esc = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(false); }; document.addEventListener("pointerdown", closeOutside); document.addEventListener("keydown", esc); window.addEventListener("resize", place); return () => { document.removeEventListener("pointerdown", closeOutside); document.removeEventListener("keydown", esc); window.removeEventListener("resize", place); }; }, [menu]);
  useEffect(() => { if (!menu || lists !== null || listError) return; let active = true; fetch(`/api/lists/mine?kind=${item.kind}&tmdbId=${item.id}`).then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Could not load your lists"); if (active) { setLists(result.lists ?? []); setQuickState(result.state); } }).catch(error => { if (active) setListError(error instanceof Error ? error.message : "Could not load your lists"); }); return () => { active = false; }; }, [menu, lists, listError, item.id, item.kind]);
  const hidden = <><input type="hidden" name="tmdbId" value={item.id} /><input type="hidden" name="kind" value={item.kind} /></>;
  const filtered = (lists ?? []).filter(list => list.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const popup = menu && typeof document !== "undefined" ? createPortal(<div className="media-context-menu" role="menu" ref={menuRef} style={{ top: position.top, left: position.left, maxHeight: position.maxHeight }}>
    <div className="context-menu-heading"><strong>{item.title}</strong><small>Quick actions</small></div>
    <Link href={`/title/${item.kind}/${item.id}`}><ExternalLink size={15} /> Open details</Link>
    <form action={quickAction} className="quick-action-form">{hidden}
      <button name="intent" value="planned" disabled={pending || quickState.progressStatus === "planned"}><ListPlus size={15} /> {quickState.progressStatus === "planned" ? "In watchlist" : "Add to watchlist"}</button>
      <button name="intent" value="completed" disabled={pending || quickState.watched}><Check size={15} /> {quickState.watched ? "Watched" : "Mark watched"}</button>
      <button name="intent" value="favorite" disabled={pending || quickState.favorite}><Heart size={15} /> {quickState.favorite ? "Favorited" : "Add to favorites"}</button>
    </form>
    <div className="context-list-section"><span>Custom lists</span>{lists === null && !listError ? <small>Loading your lists…</small> : listError ? <Link href={listError.startsWith("Sign in") ? "/login" : "/lists"}>{listError}</Link> : lists?.length ? <><label className="context-list-search"><Search size={14} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a list" aria-label="Find a list" /></label><div className="context-list-options">{filtered.map(list => list.contains ? <form action={listRemoveAction} key={list.id} onSubmit={event => { if (!window.confirm(`Remove ${item.title} from ${list.name}?`)) event.preventDefault(); }}>{hidden}<input type="hidden" name="listId" value={list.id} /><button disabled={removingFromChosenList} className="contained" title={`Remove from ${list.name}`}><span className="context-list-name">{list.name}</span><span className="context-list-action"><Check size={14} /> Added</span></button></form> : <form action={addAction} key={list.id}>{hidden}<input type="hidden" name="listId" value={list.id} /><button disabled={adding}><span className="context-list-name">{list.name}</span><span className="context-list-action"><ListPlus size={14} /> Add</span></button></form>)}</div></> : <Link href="/lists">Create your first list</Link>}</div>
    {listContext && <div className="context-remove-section"><span>Current list</span><form action={removeAction} onSubmit={event => { if (!window.confirm(`Remove ${item.title} from ${listContext.name}?`)) event.preventDefault(); }}><input type="hidden" name="listId" value={listContext.id} /><input type="hidden" name="mediaId" value={listContext.mediaId} /><input type="hidden" name="path" value={`/lists/${listContext.id}`} /><button className="danger-action" disabled={removing}><Trash2 size={15} /> {removing ? "Removing…" : `Remove from ${listContext.name}`}</button></form></div>}
    {[state, addState, listRemoveState, removeState].map((result, index) => result.status !== "idle" && <span className={`quick-action-result ${result.status}`} role="status" key={index}>{result.status === "success" ? "✓" : "!"} {result.message}</span>)}
  </div>, document.body) : null;
  return <article ref={cardRef} className="media-card interactive-card" onContextMenu={event => { event.preventDefault(); openMenu(); }} onClickCapture={event => { if (held.current) { event.preventDefault(); event.stopPropagation(); held.current = false; } }} onPointerDown={event => { if (event.pointerType === "touch") startHold(); }} onPointerUp={stopHold} onPointerCancel={stopHold} onPointerLeave={stopHold}>
    <Link href={`/title/${item.kind}/${item.id}`}><div className="poster-wrap">{poster ? <Image className="poster" src={poster} alt={`${item.title} poster`} fill sizes="(max-width: 720px) 50vw, 17vw" /> : <div className="poster-fallback">{item.title}</div>}{item.communityRating != null && <span className="card-badge" title={`${item.communityRatingCount ?? 0} MovieTracker ratings`}>{item.communityRating.toFixed(1)}<small>/10</small></span>}</div><div className="card-title truncate">{item.title}</div><div className="card-meta"><span>{yearOf(item.releaseDate)}</span><span>{item.kind === "show" ? "Series" : "Film"}</span></div>{progressLabel && <div className="card-progress">{progressLabel}</div>}</Link>
    <button className="card-menu-trigger" type="button" onClick={event => { event.preventDefault(); openMenu(); }} aria-label={`Actions for ${item.title}`} aria-haspopup="menu"><MoreVertical size={16} /></button>{popup}
  </article>;
}

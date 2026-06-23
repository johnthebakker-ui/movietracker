"use client";
import { useEffect, useRef, useState } from "react";
import { MediaCard } from "@/components/media-card";
import { RecommendationInterestButton } from "@/components/recommendation-interest-button";
import type { MediaSummary } from "@/lib/types";

type Entry = { item: MediaSummary; reason: string };
export function InfiniteRecommendationGrid({ initial, nextCursor, query, total }: { initial: Entry[]; nextCursor: string | null; query: string; total: number }) {
  const [items, setItems] = useState(initial); const [cursor, setCursor] = useState(nextCursor); const [totalCount, setTotalCount] = useState(total); const [loading, setLoading] = useState(false); const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => { const node = sentinel.current; if (!node || !cursor || loading) return; const observer = new IntersectionObserver(async entries => { if (!entries[0]?.isIntersecting) return; observer.disconnect(); setLoading(true); try { const response = await fetch(`/api/recommendations?${query}&cursor=${cursor}`); const result = await response.json(); if (response.ok) { setItems(value => [...value, ...result.items]); setCursor(result.nextCursor); } else setCursor(null); } finally { setLoading(false); } }, { rootMargin: "700px" }); observer.observe(node); return () => observer.disconnect(); }, [cursor, loading, query]);
  const dismiss = (kind: MediaSummary["kind"], id: number) => { setItems(value => value.filter(entry => entry.item.kind !== kind || entry.item.id !== id)); setTotalCount(value => Math.max(0, value - 1)); setCursor(value => value == null ? value : String(Math.max(0, Number(value) - 1))); };
  return <><div className="media-grid">{items.map(({ item, reason }) => <div className="recommendation-card" key={`${item.kind}-${item.id}`}><MediaCard item={item} /><div className="recommendation-card-note"><p>{reason}</p><RecommendationInterestButton kind={item.kind} tmdbId={item.id} compact onChange={dismissed => { if (dismissed) dismiss(item.kind, item.id); }} /></div></div>)}</div><div className="infinite-sentinel" ref={sentinel}>{loading ? "Finding more…" : cursor ? `${Math.max(0, totalCount - items.length)} recommendations waiting` : `All ${items.length} recommendations shown`}</div></>;
}

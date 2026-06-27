"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MediaCard } from "@/components/media-card";
import type { MediaSummary } from "@/lib/types";

type Entry = { item: MediaSummary; reason: string };
export function InfiniteRecommendationGrid({ initial, nextCursor, query, total }: { initial: Entry[]; nextCursor: string | null; query: string; total: number }) {
  const [items, setItems] = useState(initial); const [cursor, setCursor] = useState(nextCursor); const [totalCount, setTotalCount] = useState(total); const [loading, setLoading] = useState(false); const sentinel = useRef<HTMLDivElement>(null); const loadingRef = useRef(false);
  useEffect(() => { loadingRef.current = loading; }, [loading]);
  const loadMore = useCallback(async () => {
    if (!cursor || loadingRef.current) return;
    loadingRef.current = true; setLoading(true);
    try {
      const response = await fetch(`/api/recommendations?${query}&cursor=${cursor}`);
      const result = await response.json();
      if (response.ok) {
        setItems(value => {
          const seen = new Set(value.map(entry => `${entry.item.kind}-${entry.item.id}`));
          return [...value, ...result.items.filter((entry: Entry) => !seen.has(`${entry.item.kind}-${entry.item.id}`))];
        });
        setCursor(result.nextCursor); setTotalCount(value => Number(result.total ?? value));
      }
      else setCursor(null);
    } finally { loadingRef.current = false; setLoading(false); }
  }, [cursor, query]);
  useEffect(() => {
    if (!cursor) return;
    const checkDistance = () => {
      const node = sentinel.current;
      if (!node || loadingRef.current) return;
      if (node.getBoundingClientRect().top < window.innerHeight + 1200) void loadMore();
    };
    const observer = new IntersectionObserver(entries => { if (entries[0]?.isIntersecting) void loadMore(); }, { rootMargin: "1200px" });
    const node = sentinel.current;
    if (node) observer.observe(node);
    const timeout = window.setTimeout(checkDistance, 80);
    window.addEventListener("scroll", checkDistance, { passive: true });
    window.addEventListener("resize", checkDistance);
    return () => { window.clearTimeout(timeout); window.removeEventListener("scroll", checkDistance); window.removeEventListener("resize", checkDistance); observer.disconnect(); };
  }, [cursor, loadMore]);
  const dismiss = (kind: MediaSummary["kind"], id: number) => { setItems(value => value.filter(entry => entry.item.kind !== kind || entry.item.id !== id)); setTotalCount(value => Math.max(0, value - 1)); setCursor(value => value == null ? value : String(Math.max(0, Number(value) - 1))); };
  return <><div className="media-grid">{items.map(({ item, reason }) => <div className="recommendation-card" key={`${item.kind}-${item.id}`}><MediaCard item={item} onNotInterested={() => dismiss(item.kind, item.id)} /><div className="recommendation-card-note"><p>{reason}</p></div></div>)}</div><div className="infinite-sentinel" ref={sentinel}>{loading ? "Finding more…" : cursor ? `${Math.max(0, totalCount - items.length)} recommendations waiting` : `All ${items.length} recommendations shown`}</div></>;
}

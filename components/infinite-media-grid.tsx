"use client";

import { useEffect, useRef, useState } from "react";
import { MediaCard } from "@/components/media-card";
import type { MediaKind, MediaSummary } from "@/lib/types";

export function InfiniteMediaGrid({ initialItems, initialPage, totalPages, kind, filters }: { initialItems: MediaSummary[]; initialPage: number; totalPages: number; kind: MediaKind; filters: Record<string, string> }) {
  const [items, setItems] = useState(initialItems); const [page, setPage] = useState(initialPage); const [loading, setLoading] = useState(false); const [failed, setFailed] = useState(""); const [retry, setRetry] = useState(0);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinel.current; if (!node || page >= totalPages) return;
    const observer = new IntersectionObserver(async entries => {
      if (!entries[0]?.isIntersecting || loading) return;
      setLoading(true); setFailed("");
      try { const query = new URLSearchParams({ ...filters, kind, page: String(page + 1) }); const response = await fetch(`/api/discover?${query}`); if (!response.ok) throw new Error("Could not load more titles"); const result = await response.json(); setItems(previous => [...previous, ...result.items.filter((candidate: MediaSummary) => !previous.some(item => item.id === candidate.id && item.kind === candidate.kind))]); setPage(result.page); } catch (error) { setFailed(error instanceof Error ? error.message : "Could not load more"); } finally { setLoading(false); }
    }, { rootMargin: "700px" });
    observer.observe(node); return () => observer.disconnect();
  }, [filters, kind, loading, page, retry, totalPages]);
  return <><div className="media-grid">{items.map(item => <MediaCard key={`${item.kind}-${item.id}`} item={item} />)}</div><div className="infinite-sentinel" ref={sentinel}>{loading ? "Loading more titles…" : failed ? <button className="button ghost" onClick={() => { setFailed(""); setRetry(value => value + 1); }}>Try loading again</button> : page < totalPages ? "Keep scrolling" : `All ${items.length} loaded titles shown`}</div></>;
}

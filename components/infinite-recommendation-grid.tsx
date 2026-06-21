"use client";
import { useEffect, useRef, useState } from "react";
import { MediaCard } from "@/components/media-card";
import type { MediaSummary } from "@/lib/types";

export function InfiniteRecommendationGrid({ recommendations }: { recommendations: { item: MediaSummary; reason: string }[] }) {
  const [visible, setVisible] = useState(24); const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => { const node = sentinel.current; if (!node || visible >= recommendations.length) return; const observer = new IntersectionObserver(entries => { if (entries[0]?.isIntersecting) setVisible(value => Math.min(value + 24, recommendations.length)); }, { rootMargin: "600px" }); observer.observe(node); return () => observer.disconnect(); }, [recommendations.length, visible]);
  return <><div className="media-grid">{recommendations.slice(0, visible).map(({ item, reason }) => <div className="recommendation-card" key={`${item.kind}-${item.id}`}><MediaCard item={item} /><p>{reason}</p></div>)}</div><div className="infinite-sentinel" ref={sentinel}>{visible < recommendations.length ? `Scroll for more · ${recommendations.length - visible} waiting` : `All ${recommendations.length} recommendations shown`}</div></>;
}

"use client";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Play, Star } from "lucide-react";
import { useEffect, useState } from "react";
import type { MediaSummary } from "@/lib/types";
import { imageUrl } from "@/lib/tmdb";
import { yearOf } from "@/lib/utils";

export function HomeHeroCarousel({ items }: { items: MediaSummary[] }) {
  const [index, setIndex] = useState(0); const item = items[index]; const move = (delta: number) => setIndex(value => (value + delta + items.length) % items.length); const backdrop = imageUrl(item.backdropPath, "original");
  useEffect(() => { const timer = window.setInterval(() => setIndex(value => (value + 1) % items.length), 7000); return () => window.clearInterval(timer); }, [items.length]);
  return <section className="hero home-carousel">{backdrop && <Image key={backdrop} className="hero-bg carousel-fade" src={backdrop} alt="" fill priority={index === 0} sizes="100vw" />}<div className="hero-content"><div className="eyebrow">This week’s essential watches · {index + 1} of {items.length}</div><h1 className="display">{item.title}</h1><div className="meta-line"><span>{yearOf(item.releaseDate)}</span><span>{item.kind === "show" ? "Series" : "Film"}</span>{item.communityRating != null && <span className="score"><Star size={14} fill="currentColor" /> {item.communityRating.toFixed(1)} MovieTracker</span>}</div><p className="hero-copy">{item.overview}</p><div className="hero-actions"><Link className="button accent" href={`/title/${item.kind}/${item.id}`}><Play size={17} fill="currentColor" /> Explore title</Link><Link className="button ghost" href="/discover">Browse all</Link></div></div><div className="hero-carousel-controls"><button onClick={() => move(-1)} aria-label="Previous featured title"><ChevronLeft /></button><div>{items.map((candidate, dot) => <button className={dot === index ? "active" : ""} onClick={() => setIndex(dot)} aria-label={`Show ${candidate.title}`} key={`${candidate.kind}-${candidate.id}`} />)}</div><button onClick={() => move(1)} aria-label="Next featured title"><ChevronRight /></button></div></section>;
}

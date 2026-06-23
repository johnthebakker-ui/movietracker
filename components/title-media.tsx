"use client";

import Image from "@/components/app-image";
import { ChevronLeft, ChevronRight, ExternalLink, Eye, Play, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { imageUrl } from "@/lib/tmdb";
import type { Video } from "@/lib/types";

type GalleryImage = { filePath: string; width: number; height: number };

export function TitleMedia({ videos, images }: { videos: Video[]; images: GalleryImage[] }) {
  const trailer = videos.find(video => video.type === "Trailer" && video.official) ?? videos.find(video => video.type === "Trailer") ?? videos[0];
  const gallery = images.slice(0, 12); const [openIndex, setOpenIndex] = useState<number | null>(null); const [playTrailer, setPlayTrailer] = useState(false); const touchStart = useRef(0);
  const embedOrigin = typeof window !== "undefined" ? encodeURIComponent(window.location.origin) : "";
  const move = useCallback((delta: number) => setOpenIndex(index => index === null ? null : (index + delta + gallery.length) % gallery.length), [gallery.length]);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (openIndex === null) return; if (event.key === "Escape") setOpenIndex(null); if (event.key === "ArrowLeft") move(-1); if (event.key === "ArrowRight") move(1); }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, [openIndex, move]);
  if (!trailer && !gallery.length) return null;
  return <section className="section title-media-section" id="trailer">
    <div className="section-head"><div><div className="eyebrow">Watch & look closer</div><h2 className="display">Trailer & gallery</h2></div></div>
    {trailer && <div className="trailer-frame">{playTrailer ? <iframe src={`https://www.youtube.com/embed/${trailer.key}?rel=0&autoplay=1&playsinline=1${embedOrigin ? `&origin=${embedOrigin}` : ""}`} title={trailer.name || "Official trailer"} referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /> : <button className="trailer-preview" type="button" onClick={() => setPlayTrailer(true)} style={{ backgroundImage: `linear-gradient(rgba(5,6,7,.12),rgba(5,6,7,.7)),url(https://i.ytimg.com/vi/${trailer.key}/maxresdefault.jpg)` }}><span><Play size={28} fill="currentColor" /> Play trailer</span><small>The YouTube player loads only after you choose to play.</small></button>}<div className="trailer-label"><Play size={15} fill="currentColor" /> {trailer.name}</div><a className="trailer-external" href={`https://www.youtube.com/watch?v=${trailer.key}`} target="_blank" rel="noreferrer">Watch on YouTube <ExternalLink size={13} /></a></div>}
    {gallery.length > 0 && <div className="spoiler-gallery">{gallery.slice(0, 8).map((image, index) => <button type="button" className="spoiler-image" key={image.filePath} onClick={() => setOpenIndex(index)} aria-label="Reveal and enlarge potentially spoilery image"><Image src={imageUrl(image.filePath, "w780")!} alt="" fill sizes="(max-width: 720px) 100vw, 33vw" /><span><Eye size={18} /> Potential spoiler<small>Click to reveal</small></span></button>)}</div>}
    {openIndex !== null && <div className="lightbox" role="dialog" aria-modal="true" aria-label="Image gallery" onTouchStart={event => { touchStart.current = event.changedTouches[0].clientX; }} onTouchEnd={event => { const distance = event.changedTouches[0].clientX - touchStart.current; if (Math.abs(distance) > 45) move(distance > 0 ? -1 : 1); }}>
      <button className="lightbox-close" onClick={() => setOpenIndex(null)} aria-label="Close gallery"><X /></button><button className="lightbox-arrow left" onClick={() => move(-1)} aria-label="Previous image"><ChevronLeft /></button>
      <div className="lightbox-image"><Image src={imageUrl(gallery[openIndex].filePath, "original")!} alt={`Gallery image ${openIndex + 1}`} fill priority sizes="100vw" /></div>
      <button className="lightbox-arrow right" onClick={() => move(1)} aria-label="Next image"><ChevronRight /></button><div className="lightbox-count">{openIndex + 1} / {gallery.length}</div>
    </div>}
  </section>;
}

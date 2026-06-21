import Link from "next/link";
import type { MediaSummary } from "@/lib/types";
import { MediaCard } from "@/components/media-card";

export function MediaSection({ eyebrow, title, items, href }: { eyebrow: string; title: string; items: MediaSummary[]; href?: string }) {
  return <section className="section">
    <div className="section-head"><div><div className="eyebrow">{eyebrow}</div><h2 className="display">{title}</h2></div>{href && <Link className="text-link" href={href}>View everything →</Link>}</div>
    <div className="media-grid">{items.slice(0, 12).map((item) => <MediaCard item={item} key={`${item.kind}-${item.id}`} />)}</div>
  </section>;
}

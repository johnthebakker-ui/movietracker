import Image from "@/components/app-image";
import { List } from "lucide-react";

export function ListCardArt({ customCover, featuredArt, posters, compact = false }: { customCover?: string | null; featuredArt?: string | null; posters: string[]; compact?: boolean }) {
  const mainArt = customCover || featuredArt;
  return <div className={compact ? "profile-list-covers" : "library-list-art"}>
    {mainArt ? <Image className="list-main-art" src={mainArt} alt="" fill sizes={compact ? "360px" : "520px"} /> : posters.length ? posters.map((poster, index) => <div className={compact ? "profile-list-cover" : "library-list-poster"} key={`${poster}-${index}`}><Image src={poster} alt="" fill sizes={compact ? "180px" : "220px"} style={{ zIndex: posters.length - index }} /></div>) : <div className="list-cover-empty"><List size={compact ? 28 : 34} /></div>}
  </div>;
}

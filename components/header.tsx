import Link from "next/link";
import Image from "next/image";
import { Bell, CalendarDays, Clapperboard, Compass, Home, Library, Search, UserRound } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { getServerAuth } from "@/lib/auth-server";
import { TraktAutoSync } from "@/components/trakt-auto-sync";

export async function Header() {
  const { supabase, user } = await getServerAuth();
  let profile: any = null;
  if (user && supabase) profile = (await supabase.from("profiles").select("username,avatar_url").eq("id", user.id).maybeSingle()).data;
  return <>{user && <TraktAutoSync />}<header className="site-header">
    <div className="shell header-inner">
      <Link className="brand" href="/"><span className="brand-mark"><Clapperboard size={15} /></span>MovieTracker</Link>
      <nav className="main-nav" aria-label="Primary navigation">
        <Link href="/discover">Discover</Link><Link href="/library">Library</Link><Link href="/calendar"><CalendarDays size={14} /> Calendar</Link><Link href="/lists">Lists</Link><Link href="/recommendations">For you</Link>
      </nav>
      <div className="header-actions">
        <Link className="icon-button" href="/search" aria-label="Search"><Search size={17} /></Link>
        {user && <Link className="icon-button" href="/notifications" aria-label="Notifications"><Bell size={17} /></Link>}
        <ThemeToggle />
        {user ? <Link className="avatar" href={`/profile/${profile?.username ?? "me"}`} aria-label="Your profile">
          <Image className="avatar" src={profile?.avatar_url || "/default-avatar.svg"} width={38} height={38} alt="" />
        </Link> : <Link className="button small" href="/login">Sign in</Link>}
      </div>
    </div>
  </header><nav className="mobile-nav" aria-label="Mobile navigation"><Link href="/"><Home size={18} /><span>Home</span></Link><Link href="/discover"><Compass size={18} /><span>Discover</span></Link><Link href="/calendar"><CalendarDays size={18} /><span>Calendar</span></Link><Link href="/library"><Library size={18} /><span>Library</span></Link><Link href={user ? `/profile/${profile?.username ?? "me"}` : "/login"}><UserRound size={18} /><span>{user ? "Profile" : "Sign in"}</span></Link></nav></>;
}

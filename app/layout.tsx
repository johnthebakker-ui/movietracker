import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/header";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: { default: "MovieTracker — Your screen life, beautifully kept", template: "%s — MovieTracker" },
  description: "Track films and series, rate every episode, build unlimited lists, and discover what to watch next.",
  applicationName: "MovieTracker",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  appleWebApp: { capable: true, title: "MovieTracker", statusBarStyle: "black-translucent" }
};
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#0b0c0d" }, { media: "(prefers-color-scheme: light)", color: "#f3f1eb" }] };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body><ThemeProvider><Header />{children}<footer className="footer"><div className="shell footer-inner"><div><strong>MovieTracker</strong><p>Your screen life, beautifully kept.</p></div><div>Metadata by <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">TMDB</a>. This product uses the TMDB API but is not endorsed or certified by TMDB.</div></div></footer></ThemeProvider></body></html>;
}

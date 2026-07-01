import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "MovieTracker", short_name: "Movies", description: "Track movies and series", start_url: "/", display: "standalone", background_color: "#0b0c0d", theme_color: "#f05a38", icons: [{ src: "/favicon.png", sizes: "512x512", type: "image/png", purpose: "any" }, { src: "/favicon.png", sizes: "512x512", type: "image/png", purpose: "maskable" }] };
}

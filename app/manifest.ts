import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "MovieTracker", short_name: "Movies", description: "Track movies and series", start_url: "/", display: "standalone", background_color: "#0b0c0d", theme_color: "#f05a38", icons: [{ src: "/movietracker-logo.png", sizes: "1024x1024", type: "image/png", purpose: "any" }] };
}

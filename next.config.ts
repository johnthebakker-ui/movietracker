import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "*.supabase.co" }
    ]
  },
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  typedRoutes: false
};

export default nextConfig;

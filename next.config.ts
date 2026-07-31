import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Makes the Cloudflare bindings declared in wrangler.jsonc (the R2 cache
// bucket, vars, secrets from .dev.vars) resolvable under plain `next dev`, so
// local dev behaves like the Worker without having to go through
// `opennextjs-cloudflare preview` on every change.
initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // Earthquake's Local/Global/Map/Trends moved from top-level routes into
  // /earthquake/* as part of the navbar restructure (hazard-type-first nav);
  // Severe Weather was folded into Cyclone (same source-overlap precedent
  // Home's hazard grid already used). Permanent redirects so old bookmarks/
  // links still resolve.
  async redirects() {
    return [
      { source: '/local', destination: '/earthquake/local', permanent: true },
      { source: '/global', destination: '/earthquake/global', permanent: true },
      { source: '/map', destination: '/earthquake/map', permanent: true },
      { source: '/trends', destination: '/earthquake/trends', permanent: true },
      { source: '/severe-weather', destination: '/cyclone/global', permanent: true },
    ];
  },
};

export default nextConfig;

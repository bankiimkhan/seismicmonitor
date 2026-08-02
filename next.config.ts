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

  // public/_headers only covers files served straight out of .open-next/assets,
  // so none of it reaches a Next-rendered route. These do.
  //
  // Deliberately not a full Content-Security-Policy: the theme bootstrap in
  // app/layout.tsx is an inline <script>, so any script-src short of a nonce
  // pipeline would need 'unsafe-inline' and buy very little. frame-ancestors is
  // the part that actually needs to be per-route, and it is set here.
  async headers() {
    const baseSecurityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      // Full URLs leak the visited hazard/quake path to the third-party
      // reverse-geocode and Nominatim calls; origin-only on cross-origin.
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      // Geolocation is core to Local/Home and must stay available to this
      // origin; nothing else is used.
      { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=(), payment=(), usb=()' },
    ];

    return [
      {
        // The embed is *designed* to be iframed by third parties (see the
        // snippet on /about and AppShell's chromeless branch), so it is the one
        // route that must not forbid framing.
        source: '/embed',
        headers: baseSecurityHeaders,
      },
      {
        // Everything else, embed excluded. Without this the whole app was
        // frameable, which is a clickjacking surface on a site whose UI
        // includes a tap-to-call emergency number.
        source: '/((?!embed).*)',
        headers: [
          ...baseSecurityHeaders,
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;

import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AppShell } from "@/components/layout/AppShell";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { AnalyticsEvents } from "@/components/AnalyticsEvents";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Seismic Monitor",
  description: "Real-time earthquake monitoring and alerts",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#1c0705",
};

const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();
`;

// Cloudflare Web Analytics, replacing @vercel/analytics + @vercel/speed-insights
// (both of which only report from Vercel's edge and would just 404 here).
// Inlined at build time, so it has to be present in the *build* environment,
// not only as a Worker var -- see .env.example. Left unset (the local/CI case)
// the beacon simply isn't rendered.
//
// Note: on a custom domain proxied through Cloudflare you can enable Web
// Analytics in the dashboard instead and it injects this automatically; the
// token is only needed for workers.dev or an unproxied origin.
const beaconToken = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        <LocaleProvider>
          <ToastProvider>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-foreground"
            >
              Skip to content
            </a>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </LocaleProvider>
        <AnalyticsEvents />
        <ServiceWorkerRegister />
        {beaconToken && (
          <script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={JSON.stringify({ token: beaconToken })}
          />
        )}
      </body>
    </html>
  );
}

/** The app's own public origin, used anywhere we hand a link to someone else
 * (the /about embed snippet, the "share this app" prompt).
 *
 * Single constant because it was previously written out twice with two
 * different fallbacks -- /about used the deployed Worker origin while
 * ShareAppCard still fell back to a long-dead Vercel host, so with the env var
 * unset the share button handed out a broken link. */
export const APP_URL =
    process.env.NEXT_PUBLIC_APP_URL || 'https://seismic-monitor.bankiim.me';

// Handles future timestamps as well as past ones. Most callers pass an event
// time (always past), but app/quake/[id] renders USGS's `nextForecastTime` --
// which is future by definition -- through here too. Every future instant used
// to land in the `diffSec < 5` branch on a negative diff, so the aftershock card
// permanently read "next update just now".
export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
    const diffMs = now - timestamp;
    const future = diffMs < 0;
    const diffSec = Math.round(Math.abs(diffMs) / 1000);

    // `in 30s` / `30s ago` off the same magnitude, so the two directions can
    // never drift apart.
    const rel = (text: string) => (future ? `in ${text}` : `${text} ago`);

    if (diffSec < 5) return 'just now';
    if (diffSec < 60) return rel(`${diffSec}s`);

    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return rel(`${diffMin}m`);

    const diffHour = Math.round(diffMin / 60);
    if (diffHour < 24) return rel(`${diffHour}h`);

    const diffDay = Math.round(diffHour / 24);
    if (diffDay < 30) return rel(`${diffDay}d`);

    return new Date(timestamp).toLocaleDateString();
}

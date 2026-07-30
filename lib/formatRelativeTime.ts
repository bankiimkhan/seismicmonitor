export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
    const diffMs = now - timestamp;
    const diffSec = Math.round(diffMs / 1000);

    if (diffSec < 5) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;

    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHour = Math.round(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;

    const diffDay = Math.round(diffHour / 24);
    if (diffDay < 30) return `${diffDay}d ago`;

    return new Date(timestamp).toLocaleDateString();
}

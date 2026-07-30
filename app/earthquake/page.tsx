import { redirect } from 'next/navigation';

// Global chosen as every hazard section's default tab: no permission gate,
// shows content immediately -- consistent across all 6 hazard sections.
export default function EarthquakeIndexPage() {
    redirect('/earthquake/global');
}

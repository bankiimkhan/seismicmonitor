import { redirect } from 'next/navigation';

// Local is every hazard section's default tab: entering a section should
// answer "what is happening near me" first. It does not hard-depend on the
// permission gate -- with no location resolved the page renders its location
// prompt and the feed falls back to worldwide, so the tab still shows content
// immediately whether or not geolocation is granted.
export default function EarthquakeIndexPage() {
    redirect('/earthquake/local');
}

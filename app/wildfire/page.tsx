import { redirect } from 'next/navigation';

// Regional is every hazard section's default tab, now that Local is gone.
// It needs no permission gate: with no location resolved it falls back to the
// first region rather than blocking, so the section always shows content
// immediately whether or not geolocation is granted.
export default function WildfireIndexPage() {
    redirect('/wildfire/regional');
}

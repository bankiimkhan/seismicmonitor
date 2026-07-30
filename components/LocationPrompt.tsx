"use client";
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LocationPicker } from '@/components/LocationPicker';
import type { LocationStatus } from '@/hooks/useLocation';

interface LocationPromptProps {
    status: LocationStatus;
    onAllow: () => void;
    onManual: (loc: { lat: number; lng: number; label: string }) => void;
    /** Overrides the default "See earthquakes near you" headline -- HazardFeed reuses this component for every non-earthquake hazard type, where that copy would be wrong. */
    title?: string;
}

// Explains *why* we're about to ask for location before the browser's own
// permission dialog fires, and treats "enter it manually" as an equal
// option rather than a fallback you only discover after denying (audit
// items 2.1 and 3.2).
export function LocationPrompt({ status, onAllow, onManual, title = 'See earthquakes near you' }: LocationPromptProps) {
    const [pickerRequested, setPickerRequested] = useState(false);
    // `status` starts as 'checking' and only becomes 'denied' once the
    // permission check resolves, so seeding this from the first render's
    // status (as it used to) never actually caught the denied case -- the
    // picker stayed closed behind an extra click on the one path where it's
    // the only way forward.
    const showPicker = pickerRequested || status === 'denied';

    if (status !== 'prompting' && status !== 'denied' && status !== 'locating') return null;

    return (
        <Card className="mb-6">
            {!showPicker ? (
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <p className="font-medium text-foreground">{title}</p>
                        <p className="mt-1 text-sm text-foreground-muted">
                            We&apos;ll use your location only to filter what&apos;s shown -- it&apos;s never sent anywhere but this request.
                        </p>
                    </div>
                    <div className="flex flex-shrink-0 gap-2">
                        <Button onClick={onAllow} disabled={status === 'locating'}>
                            {status === 'locating' ? 'Locating…' : 'Allow location'}
                        </Button>
                        <Button variant="secondary" onClick={() => setPickerRequested(true)}>
                            Enter a city
                        </Button>
                    </div>
                </div>
            ) : (
                <>
                    {status === 'denied' && (
                        <div className="mb-3">
                            <p className="font-medium text-foreground">Location isn&apos;t available</p>
                            <p className="mt-1 text-sm text-foreground-muted">Enter a city instead to get a local view.</p>
                        </div>
                    )}
                    <LocationPicker
                        onSelect={onManual}
                        onCancel={status !== 'denied' ? () => setPickerRequested(false) : undefined}
                    />
                </>
            )}
        </Card>
    );
}

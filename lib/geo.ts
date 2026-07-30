const EARTH_RADIUS_KM = 6371;

// USGS "Did You Feel It?" rule-of-thumb table: max distance an event of a
// given magnitude is typically felt at. Interpolated between points so the
// cutoff doesn't jump in 1-magnitude steps.
const FELT_DISTANCE_TABLE: [mag: number, km: number][] = [
    [2.9, 15],
    [3.9, 60],
    [4.9, 150],
    [5.9, 300],
    [6.9, 600],
    [7.9, 1000],
    [8.9, 2000],
];

export function maxFeltDistanceKm(mag: number): number {
    const table = FELT_DISTANCE_TABLE;
    const [firstMag, firstDist] = table[0];

    if (mag <= firstMag) {
        return Math.max(5, firstDist * (mag / firstMag));
    }

    for (let i = 1; i < table.length; i++) {
        const [prevMag, prevDist] = table[i - 1];
        const [curMag, curDist] = table[i];
        if (mag <= curMag) {
            const t = (mag - prevMag) / (curMag - prevMag);
            return prevDist + t * (curDist - prevDist);
        }
    }

    // Beyond 8.9 ("8.9+" in the table): extrapolate using the last segment's
    // slope rather than flatlining at 2000km.
    const [m1, d1] = table[table.length - 2];
    const [m2, d2] = table[table.length - 1];
    const slope = (d2 - d1) / (m2 - m1);
    return d2 + slope * (mag - m2);
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;

    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function formatDistanceKm(km: number): string {
    if (km < 1) return '<1 km away';
    if (km < 10) return `${km.toFixed(1)} km away`;
    return `${Math.round(km)} km away`;
}

export function formatDepthKm(depthKm: number): string {
    if (depthKm < 1) return 'surface';
    return `${Math.round(depthKm)} km deep`;
}

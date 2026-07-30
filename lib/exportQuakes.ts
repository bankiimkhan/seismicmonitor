interface ExportableQuake {
    id: string;
    properties: { mag: number; place: string; time: number; url: string };
    geometry: { coordinates: [number, number, number] };
}

function download(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    // The anchor has to be in the document for the click to count as a user
    // navigation in Firefox, and the object URL has to outlive the click:
    // `a.click()` only *starts* the download, so revoking synchronously
    // right after it (as this did) can invalidate the blob before the
    // browser has read it, silently producing no file at all.
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
}

function csvEscape(value: string | number) {
    const str = String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function exportQuakesAsCsv(quakes: ExportableQuake[], filename = 'earthquakes.csv') {
    const header = ['id', 'place', 'magnitude', 'time_utc', 'lat', 'lng', 'depth_km', 'url'];
    const rows = quakes.map((q) => {
        const [lng, lat, depth] = q.geometry.coordinates;
        return [
            q.id,
            q.properties.place,
            q.properties.mag,
            new Date(q.properties.time).toISOString(),
            lat,
            lng,
            depth,
            q.properties.url,
        ]
            .map(csvEscape)
            .join(',');
    });
    download(filename, [header.join(','), ...rows].join('\n'), 'text/csv');
}

export function exportQuakesAsJson(quakes: ExportableQuake[], filename = 'earthquakes.json') {
    download(filename, JSON.stringify(quakes, null, 2), 'application/json');
}

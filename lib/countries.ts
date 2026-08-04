/**
 * Country derivation from a hazard event's free-text `place`.
 *
 * There is no country column on hazard_events and no offline polygon set in
 * this bundle, so country has to be read out of the place string each source
 * writes. Those strings are not uniform, and the naive "last comma-delimited
 * token" approach (which /api/trends used) produces a ranking where the top
 * entries are "CA", "Alaska" and "Hurricane Fausto" sitting alongside
 * "Afghanistan" as though they were peers.
 *
 * So this module normalizes what it can and returns `null` for what it can't.
 * `null` is a first-class answer here: it groups into an explicit "Unknown"
 * bucket at the call site rather than being silently attributed to a real
 * country. Under-reporting a country is recoverable; inventing one is not.
 */

// USGS writes US locations as "<distance> of <town>, <state>", with the state
// spelled out or as a two-letter code. Both forms appear in the archive.
const US_STATES = new Set([
    'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut',
    'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa',
    'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan',
    'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada',
    'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina',
    'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania', 'rhode island',
    'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont',
    'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming',
    'district of columbia', 'puerto rico', 'u.s. virgin islands', 'guam',
    'northern mariana islands', 'american samoa',
    // Two-letter forms. 'ca' is California, not Canada: this archive's US rows
    // come from USGS, whose place strings use state postal codes and spell
    // Canadian provinces out in full ("Vancouver Island, Canada").
    'ak', 'al', 'ar', 'az', 'ca', 'co', 'ct', 'de', 'fl', 'ga', 'hi', 'ia', 'id', 'il',
    'in', 'ks', 'ky', 'la', 'ma', 'md', 'me', 'mi', 'mn', 'mo', 'ms', 'mt', 'nc', 'nd',
    'ne', 'nh', 'nj', 'nm', 'nv', 'ny', 'oh', 'ok', 'or', 'pa', 'ri', 'sc', 'sd', 'tn',
    'tx', 'ut', 'va', 'vt', 'wa', 'wi', 'wv', 'wy',
]);

// India's NCS names the state, never the country -- "Chikkaballapur, Karnataka".
const INDIA_STATES = new Set([
    'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh', 'goa',
    'gujarat', 'haryana', 'himachal pradesh', 'jharkhand', 'karnataka', 'kerala',
    'madhya pradesh', 'maharashtra', 'manipur', 'meghalaya', 'mizoram', 'nagaland',
    'odisha', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu', 'telangana', 'tripura',
    'uttar pradesh', 'uttarakhand', 'west bengal', 'delhi', 'jammu and kashmir',
    'ladakh', 'andaman and nicobar islands', 'lakshadweep', 'puducherry',
    'north garo hills', 'east garo hills', 'west garo hills',
]);

const CHINA_REGIONS = new Set(['tibet', 'xizang', 'western xizang', 'eastern xizang', 'xinjiang', 'qinghai']);

// Same place under two spellings ranks as two countries otherwise. Keys are
// already lowercased and stripped of USGS's "... region" suffix.
const ALIASES: Record<string, string> = {
    'burma (myanmar)': 'Myanmar',
    'burma': 'Myanmar',
    'usa': 'United States',
    'us': 'United States',
    'united states of america': 'United States',
    'uk': 'United Kingdom',
    'russian federation': 'Russia',
    'south korea': 'South Korea',
    'north korea': 'North Korea',
    'republic of korea': 'South Korea',
    'iran (islamic republic of)': 'Iran',
    'taiwan region': 'Taiwan',
    'mx': 'Mexico',
};

// Tails that name a storm, an ocean, or a feature rather than a place on land.
// severe_weather rows are the worst offenders -- their `place` is the storm's
// own name ("Super Typhoon Dolphin"), so there is no country in the string at
// all and guessing one from the last token would be pure fabrication.
const NOT_A_COUNTRY = [
    /\b(hurricane|typhoon|cyclone|tropical storm|tropical depression|subtropical)\b/,
    /\b(ocean|sea|ridge|rise|trench|gulf|strait|channel|bay|basin|island region)\b/,
    /^(unknown|n\/a|)$/,
];

/** Strips USGS's trailing qualifiers so "India region" ranks with "India". */
function stripQualifiers(tail: string): string {
    return tail
        .replace(/\s+region$/i, '')
        .replace(/\s+border\s+region$/i, '')
        .replace(/^(northern|southern|eastern|western|central|north|south|east|west|off the coast of|near the coast of|offshore)\s+/i, '')
        .trim();
}

function titleCase(s: string): string {
    return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/**
 * Best-effort country for an event, or `null` when the place string does not
 * carry one. Callers must render `null` as an explicit unknown bucket, never
 * fold it into a named country.
 */
export function countryFromPlace(place: string | null | undefined): string | null {
    if (!place) return null;

    const parts = place.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) return null;

    const rawTail = parts[parts.length - 1].toLowerCase();
    if (NOT_A_COUNTRY.some((re) => re.test(rawTail))) return null;

    const tail = stripQualifiers(rawTail);
    if (!tail) return null;

    if (US_STATES.has(tail)) return 'United States';
    if (INDIA_STATES.has(tail)) return 'India';
    if (CHINA_REGIONS.has(tail)) return 'China';
    if (ALIASES[tail]) return ALIASES[tail];

    // A bare town with no country after it ("Chikkaballapur") is not a country;
    // requiring either a comma-separated tail or a multi-word/known name keeps
    // single unqualified town names out of the country ranking. A one-part
    // place string is almost always just a country already ("Nepal").
    if (parts.length === 1 || tail.length > 2) return titleCase(tail);
    return null;
}

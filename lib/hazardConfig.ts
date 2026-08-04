import type { IconProps } from '@/components/ui/icons';
import {
    ActivityIcon, CycloneIcon, LandslideIcon, VolcanoIcon, FlameIcon, WavesIcon,
} from '@/components/ui/icons';

/** Ways a set of events can be ranked on Trends. Which of these are offered is
 * decided per hazard type by `rankings` below -- an average or maximum
 * severity is meaningless for a hazard whose events carry no severity number,
 * and offering it anyway produces a leaderboard of nulls. */
export type RankingMethod = 'count' | 'frequency' | 'avgSeverity' | 'maxSeverity';

export const RANKING_LABELS: Record<RankingMethod, string> = {
    count: 'Total events',
    frequency: 'Events per day',
    avgSeverity: 'Average severity',
    maxSeverity: 'Peak severity',
};

/** Describes the one numeric measure a hazard type reports, if it reports one.
 *
 * `hasValue: false` types (volcano, landslide, tsunami) store `magnitude: null`
 * on every row. They are not "zero severity" -- the sources publish no severity
 * number at all -- so anything that averages, maxes, colour-codes or sorts by
 * severity has to be withheld for them rather than shown as 0. */
export interface SeverityMetric {
    /** Column header / axis label, e.g. "Magnitude", "Max wind". */
    label: string;
    /** Short unit rendered beside the number, e.g. "M", "kts", "MW". */
    unit: string;
    /** Decimal places when formatting the raw value. */
    precision: number;
    /** Renders a value with its unit, in the form this hazard's readers expect. */
    format: (value: number) => string;
    /** Ascending thresholds at which a value becomes notable / severe. Used for
     * the same low/medium/high banding across every surface, so a number is
     * never coloured one way on a card and another way in a table. */
    bands: { warning: number; critical: number };
}

export interface HazardConfig {
    slug: string;
    /** Value for the `hazard_events.hazard_type` column / `/api/hazards` & `/api/trends` `type` param -- comma-joined where two source granularities of the same phenomenon are folded together (cyclone + severe_weather, see Milestone 12's Home page precedent). */
    hazardType: string;
    title: string;
    description: string;
    icon: React.FC<IconProps>;
    /** HazardTable's value-column header; '—' for hazard types with no numeric severity metric (volcano/landslide/tsunami all report `magnitude: null`). */
    valueLabel: string;
    /** Short unit suffix for StatCard/HazardWatchCard footers, e.g. "FRP"/"kts". Omitted when hasValue is false. */
    unit?: string;
    hasValue: boolean;
    /** Present exactly when `hasValue` is true. Everything that formats, bands,
     * filters or ranks by severity reads it from here, so a hazard type without
     * one simply cannot be given earthquake-shaped treatment by accident. */
    severity?: SeverityMetric;
    /** Ranking methods Trends may offer for this hazard type. Severity-based
     * entries are omitted for types with no severity metric. */
    rankings: RankingMethod[];
    /** Time-range <select> presets shown on Local/Global, in days. */
    rangeOptionsDays: number[];
    defaultRangeDays: number;
    /** Home's HazardWatchCard fetch window, in hours -- mirrors this hazard's own Global page default range. */
    watchHours: number;
    itemNounSingular: string;
    itemNounPlural: string;
    emptyTitle: string;
    emptyDescription: string;
    errorTitle: string;
    /** Standing caveat about what this hazard's feed can and cannot tell you,
     * shown above the results whether or not any are present. Exists because an
     * empty list is otherwise indistinguishable from "nothing is wrong": for
     * landslide the only wired source publishes nothing at all, and for tsunami
     * the coverage is regional. Omitted for hazard types whose feed means what
     * a reader would assume it means. */
    coverageNotice?: string;
}

export const HAZARD_SLUGS = ['earthquake', 'tsunami', 'cyclone', 'landslide', 'volcano', 'wildfire'] as const;
export type HazardSlug = typeof HAZARD_SLUGS[number];

export const HAZARD_CONFIG: Record<HazardSlug, HazardConfig> = {
    earthquake: {
        slug: 'earthquake',
        hazardType: 'earthquake',
        title: 'Earthquakes',
        description: 'Live seismic monitoring (USGS + India NCS + GDACS)',
        icon: ActivityIcon,
        valueLabel: 'Magnitude',
        unit: 'M',
        hasValue: true,
        severity: {
            label: 'Magnitude',
            unit: 'M',
            precision: 1,
            format: (v) => `M${v.toFixed(1)}`,
            // Richter banding, matching components/ui/Badge.tsx's getSeverity so
            // a quake is not "warning" on one surface and "stable" on another.
            bands: { warning: 5, critical: 6 },
        },
        rankings: ['count', 'frequency', 'avgSeverity', 'maxSeverity'],
        rangeOptionsDays: [7, 30, 90, 365],
        defaultRangeDays: 30,
        watchHours: 24,
        itemNounSingular: 'earthquake',
        itemNounPlural: 'earthquakes',
        emptyTitle: 'No earthquakes found',
        emptyDescription: 'Nothing reported in this window.',
        errorTitle: "Couldn't load earthquake data",
    },
    tsunami: {
        slug: 'tsunami',
        hazardType: 'tsunami',
        title: 'Tsunami Warnings',
        description: 'Active tsunami warnings, watches, and advisories (NOAA/NWS)',
        icon: WavesIcon,
        valueLabel: '—',
        hasValue: false,
        // NOAA/NWS publishes a category (warning/watch/advisory), carried on
        // alert_level, but no numeric severity. Ranking is therefore by how
        // often alerts occur, never by "average tsunami".
        rankings: ['count', 'frequency'],
        rangeOptionsDays: [1, 3, 7, 30],
        defaultRangeDays: 7,
        watchHours: 168,
        itemNounSingular: 'tsunami alert',
        itemNounPlural: 'tsunami alerts',
        emptyTitle: 'No active tsunami alerts',
        emptyDescription: 'No tsunami warnings, watches, or advisories reported in this window.',
        errorTitle: "Couldn't load tsunami data",
        // Promoted out of emptyDescription so it is visible whether or not the
        // list is empty -- the regional limit matters just as much when one
        // alert IS showing (it does not imply the rest of the world is clear).
        coverageNotice:
            'Coverage is US coastal waters and territories only (NOAA/NWS). Absence of an alert here is not a global all-clear — check your national tsunami warning centre.',
    },
    cyclone: {
        slug: 'cyclone',
        hazardType: 'cyclone,severe_weather',
        title: 'Tropical Cyclones',
        description: 'Active storms (NOAA NHC) and tracked storms worldwide (NASA EONET)',
        icon: CycloneIcon,
        valueLabel: 'Max Wind (kts)',
        unit: 'kts',
        hasValue: true,
        severity: {
            label: 'Max wind',
            unit: 'kts',
            precision: 0,
            format: (v) => `${Math.round(v)} kts`,
            // Saffir-Simpson in knots: 64 kt is hurricane force (cat 1), 96 kt
            // is cat 3 / "major". Not a magnitude scale, and deliberately not
            // sharing earthquake's thresholds.
            bands: { warning: 64, critical: 96 },
        },
        rankings: ['count', 'frequency', 'avgSeverity', 'maxSeverity'],
        rangeOptionsDays: [3, 7, 30],
        defaultRangeDays: 7,
        watchHours: 168,
        itemNounSingular: 'cyclone event',
        itemNounPlural: 'cyclone events',
        emptyTitle: 'No active cyclones found',
        emptyDescription: 'No storm advisories or tracked positions reported in this window.',
        errorTitle: "Couldn't load cyclone data",
    },
    landslide: {
        slug: 'landslide',
        hazardType: 'landslide',
        title: 'Landslides',
        description: 'Landslide reporting is currently unavailable — see the notice below',
        icon: LandslideIcon,
        valueLabel: '—',
        hasValue: false,
        rankings: ['count', 'frequency'],
        rangeOptionsDays: [7, 30, 90],
        defaultRangeDays: 30,
        watchHours: 720,
        itemNounSingular: 'landslide',
        itemNounPlural: 'landslides',
        emptyTitle: 'No landslide data available',
        emptyDescription: 'This is not the same as "no landslides occurred" — see the notice above.',
        errorTitle: "Couldn't load landslide data",
        // NASA EONET's `landslides` category is the only source wired for this
        // hazard type, and it publishes nothing: checked live, it returns zero
        // events at status=open and zero over a 365-day window, and no landslide
        // row has ever reached hazard_events. Saying "No landslides found"
        // against that reads as reassurance, which is the opposite of the truth.
        coverageNotice:
            'No landslide source is currently reporting. This section is backed by NASA EONET\'s landslide category, which is not publishing events — an empty list here means "no data", not "no landslides". Do not treat this page as evidence of safety.',
    },
    volcano: {
        slug: 'volcano',
        hazardType: 'volcano',
        title: 'Volcanic Activity',
        description: 'Tracked volcanoes worldwide (NASA EONET / Smithsonian Global Volcanism Program)',
        icon: VolcanoIcon,
        valueLabel: '—',
        hasValue: false,
        // EONET/Smithsonian report that a volcano is active, not how strongly.
        // VEI exists as a concept but is not in either feed, so there is no
        // severity number to rank on.
        rankings: ['count', 'frequency'],
        rangeOptionsDays: [30, 90, 365],
        defaultRangeDays: 90,
        watchHours: 2160,
        itemNounSingular: 'volcano',
        itemNounPlural: 'volcanoes',
        emptyTitle: 'No volcanic activity found',
        emptyDescription: 'No tracked volcanoes reported active in this window.',
        errorTitle: "Couldn't load volcano data",
    },
    wildfire: {
        slug: 'wildfire',
        hazardType: 'wildfire',
        title: 'Wildfire Hotspots',
        description: 'Satellite detections (NASA FIRMS) and tracked incidents (NASA EONET) worldwide',
        icon: FlameIcon,
        valueLabel: 'FRP (MW)',
        unit: 'FRP',
        hasValue: true,
        severity: {
            label: 'Fire radiative power',
            unit: 'MW',
            precision: 0,
            format: (v) => `${Math.round(v)} MW`,
            // FRP has no standard banding; these follow FIRMS' own rough
            // "notable / intense" split for VIIRS pixels.
            bands: { warning: 50, critical: 200 },
        },
        rankings: ['count', 'frequency', 'avgSeverity', 'maxSeverity'],
        rangeOptionsDays: [1, 3, 7],
        defaultRangeDays: 1,
        watchHours: 24,
        itemNounSingular: 'wildfire event',
        itemNounPlural: 'wildfire events',
        emptyTitle: 'No wildfire activity found',
        emptyDescription: 'No satellite detections or tracked incidents in this window.',
        errorTitle: "Couldn't load wildfire data",
    },
};

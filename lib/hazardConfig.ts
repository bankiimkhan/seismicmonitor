import type { IconProps } from '@/components/ui/icons';
import {
    ActivityIcon, CycloneIcon, LandslideIcon, VolcanoIcon, FlameIcon, WavesIcon,
} from '@/components/ui/icons';

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

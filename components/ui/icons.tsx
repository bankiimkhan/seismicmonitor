import React from 'react';

export interface IconProps {
    size?: number;
    strokeWidth?: number;
    className?: string;
}

type IconDef = React.ReactNode;

// Single shared factory: every icon is a 24x24 stroke SVG (feather-style),
// so the whole app gets one consistent line-weight/proportions instead of
// the ad-hoc inline <svg> blocks previously duplicated per component.
function createIcon(displayName: string, children: IconDef) {
    const Icon: React.FC<IconProps> = ({ size = 16, strokeWidth = 1.75, className = '' }) => (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
        >
            {children}
        </svg>
    );
    Icon.displayName = displayName;
    return Icon;
}

export const HomeIcon = createIcon('HomeIcon', <path d="M3 11.5 12 4l9 7.5M5.5 10v9a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1v-9" />);

export const MapPinIcon = createIcon('MapPinIcon', <>
    <path d="M20 10.5c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10.5" r="2.75" />
</>);

export const GlobeIcon = createIcon('GlobeIcon', <>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.7 3.8 6 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-6-3.8-9S9.5 5.7 12 3Z" />
</>);

export const MapIcon = createIcon('MapIcon', <>
    <path d="M9 4.5 3.5 6.3v13.2L9 17.7l6 2.8 5.5-1.8V5.5L15 7.3M9 4.5l6 2.8M9 4.5v13.2M15 7.3v13.2" />
</>);

export const TrendingUpIcon = createIcon('TrendingUpIcon', <>
    <path d="m3 17 6-6 4 4 8-8" />
    <path d="M15 6h6v6" />
</>);

export const InfoIcon = createIcon('InfoIcon', <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.5v.01" />
</>);

export const SearchIcon = createIcon('SearchIcon', <>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.35-4.35" />
</>);

export const CommandIcon = createIcon('CommandIcon', <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3z" />);

export const SunIcon = createIcon('SunIcon', <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
</>);

export const MoonIcon = createIcon('MoonIcon', <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />);

export const MenuIcon = createIcon('MenuIcon', <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" />);

export const XIcon = createIcon('XIcon', <path d="M6 6l12 12M18 6 6 18" />);

export const ChevronDownIcon = createIcon('ChevronDownIcon', <path d="M6 9l6 6 6-6" />);
export const ChevronRightIcon = createIcon('ChevronRightIcon', <path d="M9 6l6 6-6 6" />);
export const ChevronLeftIcon = createIcon('ChevronLeftIcon', <path d="M15 6l-6 6 6 6" />);

export const ArrowUpRightIcon = createIcon('ArrowUpRightIcon', <path d="M7 17 17 7M8 7h9v9" />);
export const ArrowUpIcon = createIcon('ArrowUpIcon', <path d="M12 19V5M6 11l6-6 6 6" />);
export const ArrowDownIcon = createIcon('ArrowDownIcon', <path d="M12 5v14M6 13l6 6 6-6" />);

export const ShareIcon = createIcon('ShareIcon', <>
    <circle cx="18" cy="5" r="2.4" />
    <circle cx="6" cy="12" r="2.4" />
    <circle cx="18" cy="19" r="2.4" />
    <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
</>);

export const DownloadIcon = createIcon('DownloadIcon', <path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M4.5 17v2a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-2" />);

export const FilterIcon = createIcon('FilterIcon', <path d="M4 5h16l-6 7.5V19l-4 2v-8.5L4 5Z" />);

export const AlertTriangleIcon = createIcon('AlertTriangleIcon', <>
    <path d="M10.6 4 2.9 18a1.6 1.6 0 0 0 1.4 2.4h15.4a1.6 1.6 0 0 0 1.4-2.4L13.4 4a1.6 1.6 0 0 0-2.8 0Z" />
    <path d="M12 10v4M12 17.5v.01" />
</>);

export const AlertCircleIcon = createIcon('AlertCircleIcon', <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16.5v.01" />
</>);

export const CheckCircleIcon = createIcon('CheckCircleIcon', <>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.5 2.3 2.3L16 9.7" />
</>);

export const ActivityIcon = createIcon('ActivityIcon', <path d="M3 12h4l2.2-7L13 19l2.5-7H21" />);

export const CopyIcon = createIcon('CopyIcon', <>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5.5 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v.5" />
</>);

export const ExternalLinkIcon = createIcon('ExternalLinkIcon', <>
    <path d="M9 5H6.5A2.5 2.5 0 0 0 4 7.5v10A2.5 2.5 0 0 0 6.5 20h10a2.5 2.5 0 0 0 2.5-2.5V15" />
    <path d="M14 4h6v6M20 4 11 13" />
</>);

export const ClockIcon = createIcon('ClockIcon', <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
</>);

export const LayersIcon = createIcon('LayersIcon', <path d="m12 3 9 4.7-9 4.7-9-4.7L12 3ZM3 12l9 4.7 9-4.7M3 16.5l9 4.7 9-4.7" />);

export const SlidersIcon = createIcon('SlidersIcon', <path d="M4 6h9m4 0h3M4 12h3m4 0h9M4 18h13m4 0h-1M9 4v4M17 10v4M15 16v4" />);

export const ChevronsLeftIcon = createIcon('ChevronsLeftIcon', <path d="M17 6 11 12l6 6M10 6 4 12l6 6" />);
export const ChevronsRightIcon = createIcon('ChevronsRightIcon', <path d="M7 6l6 6-6 6M14 6l6 6-6 6" />);

export const RefreshIcon = createIcon('RefreshIcon', <path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.6M4 13a8 8 0 0 0 13.7 4.7L20 15.4M4 4v4.6h4.6M19.4 15.4H15v4.6" />);

export const FlameIcon = createIcon('FlameIcon', <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.5-2-5-.5 1.5-1.5 2-2 1 0-2.5-1.5-4.5-3.5-6C12 7 11 9 11 11c-1.5-1-2-3-2-4.5C6.5 8.5 5 11.5 5 15a7 7 0 0 0 7 7Z" />);

export const VolcanoIcon = createIcon('VolcanoIcon', <>
    <path d="M12 4 4 20h16L12 4Z" />
    <path d="M9.5 9.5 12 4l1 2-1.5 2 2 1.5-1 2" />
    <path d="M8 20c1-2 2-3 4-3s3 1 4 3" />
</>);

export const StormCloudIcon = createIcon('StormCloudIcon', <>
    <path d="M6.5 17a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 16.5 8 4.5 4.5 0 0 1 16 17H6.5Z" />
    <path d="M13 13.5 10.5 17h2.5L11 20.5" />
</>);

export const LandslideIcon = createIcon('LandslideIcon', <>
    <path d="M3 18h4l3-6 3 4 2-3 6 5" />
    <path d="M3 20.5h18" />
</>);

export const CycloneIcon = createIcon('CycloneIcon', <path d="M12 3a5 5 0 0 1 5 5c0 2-1.5 3.5-4 3.5M12 3a5 5 0 0 0-5 5c0 2 1.5 3.5 4 3.5M21 12a5 5 0 0 1-5 5c-2 0-3.5-1.5-3.5-4M21 12a5 5 0 0 0-5-5c-2 0-3.5 1.5-3.5 4M12 21a5 5 0 0 1-5-5c0-2 1.5-3.5 4-3.5M3 12a5 5 0 0 1 5-5c2 0 3.5 1.5 3.5 4" />);

export const WavesIcon = createIcon('WavesIcon', <>
    <path d="M2 8c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0" />
    <path d="M2 14c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0" />
    <path d="M2 20c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0" />
</>);

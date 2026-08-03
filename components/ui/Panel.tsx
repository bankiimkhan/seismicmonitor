import React from 'react';

interface PanelProps {
    /** Silkscreened module name. Rendered as a chip straddling the top bezel, interrupting the border the way a hardware faceplate does. */
    title?: React.ReactNode;
    /** Small lit/unlit indicator or control cluster pinned to the top-right of the bezel, opposite the legend. */
    badge?: React.ReactNode;
    titleAlign?: 'center' | 'left';
    children: React.ReactNode;
    className?: string;
    /** Dims the bezel to the unlit border color -- for supporting modules that shouldn't compete with a lit one. */
    tone?: 'accent' | 'dim';
    /** Adds hover bloom + pointer affordance for panels that are themselves a click target (wrap in Link separately). */
    interactive?: boolean;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    as?: 'div' | 'section' | 'article' | 'li';
}

const PADDING = {
    none: '',
    // Top padding always clears the legend chip that overlaps the border.
    sm: 'px-3 pb-3 pt-5',
    md: 'px-4 pb-4 pt-6',
    lg: 'px-5 pb-5 pt-7 md:px-6 md:pb-6',
};

/**
 * The base module of the panel UI: an outlined bezel with its name set into
 * the top edge. Fills are deliberately absent here -- on this face a fill
 * means "lit" (see Readout, LedMeter, .pad), so an idle container stays an
 * outline and never competes with live data for attention.
 */
export const Panel: React.FC<PanelProps> = ({
    title, badge, titleAlign = 'center', children, className = '',
    tone = 'accent', interactive = false, padding = 'md', as: Tag = 'div',
}) => (
    <Tag
        className={`bezel relative ${tone === 'dim' ? 'bezel-dim' : ''} ${PADDING[padding]} ${interactive ? 'hover-lift cursor-pointer' : ''} ${className}`}
    >
        {title && (
            <span
                className={`legend absolute -top-[9px] z-10 px-2 text-[10px] font-bold leading-[18px] ${titleAlign === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-4'}`}
            >
                {title}
            </span>
        )}
        {badge && (
            <span className="absolute -top-[9px] right-4 z-10 flex items-center gap-1.5 bg-[var(--legend-bg)] px-2 leading-[18px]">
                {badge}
            </span>
        )}
        {children}
    </Tag>
);

/** Rule used to divide sub-sections inside a panel, matching the bezel's line weight. */
export const PanelDivider: React.FC<{ className?: string }> = ({ className = '' }) => (
    <hr className={`my-3 border-0 border-t border-accent/25 ${className}`} aria-hidden="true" />
);

/**
 * Small lit/unlit square with a label, the panel's boolean display. `on`
 * drives the fill; the label is always readable either way, so state is never
 * signalled by glow alone.
 */
export const Led: React.FC<{
    on?: boolean;
    label?: React.ReactNode;
    tone?: 'accent' | 'danger' | 'warning' | 'success';
    /** Blinks while true -- reserved for genuinely live signals. */
    pulse?: boolean;
    className?: string;
}> = ({ on = false, label, tone = 'accent', pulse = false, className = '' }) => {
    const toneClass = tone === 'accent' ? '' : `led-${tone}`;
    const dot = (
        <span
            className={`led h-2 w-3 flex-shrink-0 ${toneClass} ${on ? 'led-on' : ''} ${on && pulse ? 'live-dot' : ''}`}
            aria-hidden="true"
        />
    );

    if (!label) return <span className={className}>{dot}</span>;

    return (
        <span className={`inline-flex items-center gap-1.5 ${className}`}>
            <span className={`text-[9px] font-bold uppercase tracking-[0.18em] ${on ? 'text-accent glow-text' : 'text-foreground-subtle'}`}>
                {label}
            </span>
            {dot}
        </span>
    );
};

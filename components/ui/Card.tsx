import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    /** Brighter bezel + bloom -- for hero/featured cards that should visually outrank their siblings. */
    elevated?: boolean;
    /** Adds hover bloom + pointer affordance for cards that are themselves a click target (wrap in Link separately). */
    interactive?: boolean;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    as?: 'div' | 'article' | 'li';
}

const PADDING = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6 md:p-7',
};

/**
 * Generic module box. This is the un-legended sibling of Panel: same bezel
 * treatment, no silkscreened title. Prefer Panel where the box has a name.
 */
export const Card: React.FC<CardProps> = ({
    children, className = '', elevated = false, interactive = false, padding = 'md', as: Tag = 'div',
}) => {
    return (
        <Tag
            className={`bezel transition-all duration-[var(--duration-slow)] ${elevated ? 'shadow-[var(--glow-md),inset_0_0_28px_rgb(var(--accent-rgb)/0.08)]' : 'bezel-dim'} ${PADDING[padding]} ${interactive ? 'hover-lift cursor-pointer' : ''} ${className}`}
        >
            {children}
        </Tag>
    );
};

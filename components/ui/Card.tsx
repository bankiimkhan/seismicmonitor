import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    /** Larger shadow + slightly stronger border -- for hero/featured cards that should visually outrank their siblings. */
    elevated?: boolean;
    /** Adds hover-lift + pointer affordance for cards that are themselves a click target (wrap in Link separately). */
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

export const Card: React.FC<CardProps> = ({
    children, className = '', elevated = false, interactive = false, padding = 'md', as: Tag = 'div',
}) => {
    return (
        <Tag
            className={`rounded-2xl border bg-surface/90 backdrop-blur-xl transition-all duration-[var(--duration-slow)] ${elevated ? 'border-border-strong/90 shadow-[0_8px_32px_rgba(0,0,0,0.9),0_0_20px_rgba(0,240,255,0.12)]' : 'border-border/80 shadow-md'} ${PADDING[padding]} ${interactive ? 'hover-lift cursor-pointer hover:border-accent/50 hover:shadow-[0_0_22px_rgba(0,240,255,0.25)]' : ''} ${className}`}
        >
            {children}
        </Tag>
    );
};

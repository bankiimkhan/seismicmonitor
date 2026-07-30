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
            className={`rounded-lg border bg-surface/75 backdrop-blur-md ${elevated ? 'border-border-strong shadow-lg' : 'border-border shadow-sm'} ${PADDING[padding]} ${interactive ? 'hover-lift cursor-pointer hover:border-accent/40' : ''} ${className}`}
        >
            {children}
        </Tag>
    );
};

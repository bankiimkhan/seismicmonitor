"use client";
import React, { useId, useState } from 'react';

interface TooltipProps {
    label: string;
    children: React.ReactElement<Record<string, unknown>>;
    side?: 'top' | 'bottom';
}

export function Tooltip({ label, children, side = 'top' }: TooltipProps) {
    const [visible, setVisible] = useState(false);
    const id = useId();

    return (
        <span
            className="relative inline-flex"
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
            onFocus={() => setVisible(true)}
            onBlur={() => setVisible(false)}
        >
            {React.cloneElement(children, { 'aria-describedby': visible ? id : undefined })}
            {visible && (
                <span
                    id={id}
                    role="tooltip"
                    className={`animate-pop-in pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-lg ${side === 'top' ? 'bottom-full left-1/2 mb-2 -translate-x-1/2' : 'top-full left-1/2 mt-2 -translate-x-1/2'}`}
                >
                    {label}
                </span>
            )}
        </span>
    );
}

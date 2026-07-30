"use client";
import React, { useRef, useState } from 'react';
import { useOnClickOutside } from '@/hooks/useOnClickOutside';

interface DropdownProps {
    trigger: (state: { open: boolean; toggle: () => void }) => React.ReactNode;
    children: (close: () => void) => React.ReactNode;
    align?: 'left' | 'right';
    className?: string;
}

export function Dropdown({ trigger, children, align = 'left', className = '' }: DropdownProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useOnClickOutside(ref, () => setOpen(false));

    return (
        <div ref={ref} className="relative inline-block">
            {trigger({ open, toggle: () => setOpen((o) => !o) })}
            {open && (
                <div
                    role="menu"
                    className={`animate-pop-in absolute z-40 mt-2 min-w-[180px] rounded-lg border border-border bg-surface p-1 shadow-lg ${align === 'right' ? 'right-0' : 'left-0'} ${className}`}
                >
                    {children(() => setOpen(false))}
                </div>
            )}
        </div>
    );
}

export const DropdownItem: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = '', children, ...props }) => (
    <button
        role="menuitem"
        type="button"
        className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-hover ${className}`}
        {...props}
    >
        {children}
    </button>
);

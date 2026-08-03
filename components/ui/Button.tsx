import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg' | 'icon';
}

const SIZES = {
    sm: 'px-3 py-1.5 text-[10px] gap-1.5',
    md: 'px-4 py-2 text-xs gap-2',
    lg: 'px-5 py-2.5 text-xs gap-2',
    icon: 'h-9 w-9 p-0',
};

/**
 * Panel key. `primary` is a lit key (solid amber, dark legend); the rest are
 * unlit keys that light on press -- the `.pad` class carries the press-down
 * translate and momentary illumination.
 */
export const Button: React.FC<ButtonProps> = ({ children, className = '', variant = 'primary', size = 'md', ...props }) => {
    const base = "pad inline-flex items-center justify-center font-bold uppercase tracking-[0.18em] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";

    const variants = {
        primary: "bg-accent text-accent-foreground shadow-[var(--glow-sm)] hover:bg-accent-hover hover:shadow-[var(--glow-lg)]",
        secondary: "border border-accent/45 text-accent hover:border-accent",
        danger: "border border-danger/60 bg-[rgb(var(--danger-rgb)/0.16)] text-danger hover:bg-danger hover:text-background hover:shadow-[0_0_20px_rgb(var(--danger-rgb)/0.6)] active:bg-danger active:text-background",
        ghost: "bg-transparent text-foreground-muted hover:text-accent",
    };

    return (
        <button className={`${base} ${variants[variant]} ${SIZES[size]} ${className}`} {...props}>
            {children}
        </button>
    );
};

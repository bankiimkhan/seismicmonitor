import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg' | 'icon';
}

const SIZES = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-sm gap-2',
    icon: 'h-9 w-9 p-0',
};

export const Button: React.FC<ButtonProps> = ({ children, className = '', variant = 'primary', size = 'md', ...props }) => {
    const base = "inline-flex items-center justify-center rounded-lg font-mono font-semibold tracking-wider uppercase transition-all duration-[var(--duration-base)] ease-[var(--ease-out)] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

    const variants = {
        primary: "bg-gradient-to-r from-accent via-cyan-400 to-cyan-300 text-accent-foreground border border-accent/60 shadow-[0_0_15px_rgba(0,240,255,0.4)] hover:shadow-[0_0_25px_rgba(0,240,255,0.75)]",
        secondary: "border border-border/90 bg-surface/80 text-foreground backdrop-blur-md hover:bg-surface-hover hover:border-accent/50 hover:text-accent hover:shadow-[0_0_14px_rgba(0,240,255,0.2)]",
        danger: "border border-danger/60 bg-danger-bg/80 text-danger shadow-[0_0_12px_rgba(255,42,109,0.25)] hover:bg-danger hover:text-white hover:shadow-[0_0_22px_rgba(255,42,109,0.6)]",
        ghost: "text-foreground-muted hover:bg-surface-hover hover:text-accent hover:shadow-[0_0_10px_rgba(0,240,255,0.15)]",
    };

    return (
        <button className={`${base} ${variants[variant]} ${SIZES[size]} ${className}`} {...props}>
            {children}
        </button>
    );
};

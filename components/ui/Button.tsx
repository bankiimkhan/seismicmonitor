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
    const base = "inline-flex items-center justify-center rounded-md font-medium transition-all duration-[var(--duration-fast)] ease-[var(--ease-out)] motion-safe:active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:scale-100 disabled:hover:translate-y-0 disabled:hover:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

    const variants = {
        primary: "bg-accent text-accent-foreground shadow-sm hover:bg-accent-hover hover:shadow-[0_0_20px_-2px_var(--accent)] motion-safe:hover:-translate-y-px motion-safe:hover:scale-[1.02]",
        secondary: "border border-border bg-surface text-foreground hover:bg-surface-hover hover:border-border-strong hover:shadow-md motion-safe:hover:-translate-y-px motion-safe:hover:scale-[1.02]",
        danger: "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20 hover:shadow-[0_0_16px_-4px_var(--danger)] motion-safe:hover:-translate-y-px motion-safe:hover:scale-[1.02]",
        ghost: "text-foreground-muted hover:bg-surface-hover hover:text-foreground motion-safe:hover:scale-[1.02]",
    };

    return (
        <button className={`${base} ${variants[variant]} ${SIZES[size]} ${className}`} {...props}>
            {children}
        </button>
    );
};

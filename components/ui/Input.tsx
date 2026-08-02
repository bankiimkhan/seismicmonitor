import React from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const fieldClasses = "w-full rounded-lg border border-border/90 bg-background/90 px-3 py-2 text-sm text-foreground placeholder:text-foreground-subtle transition-all duration-[var(--duration-base)] hover:border-accent/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 focus:shadow-[0_0_16px_rgba(0,240,255,0.35)] disabled:cursor-not-allowed disabled:opacity-50";

export const Input: React.FC<InputProps> = ({ className = '', ...props }) => {
    return <input className={`${fieldClasses} ${className}`} {...props} />;
};

export const Select: React.FC<SelectProps> = ({ className = '', children, ...props }) => {
    return (
        <select className={`${fieldClasses} cursor-pointer ${className}`} {...props}>
            {children}
        </select>
    );
};

export const Label: React.FC<{ htmlFor?: string; children: React.ReactNode; className?: string }> = ({ htmlFor, children, className = '' }) => (
    <label htmlFor={htmlFor} className={`mb-1.5 block text-xs font-mono font-semibold uppercase tracking-wider text-foreground-muted ${className}`}>
        {children}
    </label>
);

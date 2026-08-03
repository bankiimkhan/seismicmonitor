import React from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

// Fields are recessed display windows: dark inset well, amber value, and a
// bloom on focus so the active field reads as the one that's driven.
const fieldClasses = "screen w-full border border-accent/35 px-3 py-2 text-sm tracking-wider text-accent placeholder:text-foreground-subtle placeholder:tracking-[0.18em] placeholder:uppercase transition-all duration-[var(--duration-base)] hover:border-accent/60 focus:border-accent focus:outline-none focus:shadow-[var(--glow-md),inset_0_2px_10px_rgba(0,0,0,0.55)] disabled:cursor-not-allowed disabled:opacity-40";

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
    <label htmlFor={htmlFor} className={`mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-foreground-muted ${className}`}>
        {children}
    </label>
);

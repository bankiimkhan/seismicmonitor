import React from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const fieldClasses = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-foreground-subtle shadow-xs transition-colors duration-[var(--duration-fast)] hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50";

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
    <label htmlFor={htmlFor} className={`mb-1.5 block text-xs font-medium text-foreground-muted ${className}`}>
        {children}
    </label>
);

"use client";
import { useInView } from '@/hooks/useInView';

interface RevealProps {
    children: React.ReactNode;
    as?: 'div' | 'section' | 'li';
    className?: string;
    /** Sibling position when mapping over a list -- drives a pure-CSS stagger delay. */
    index?: number;
    staggerMs?: number;
    variant?: 'fade-up' | 'fade' | 'scale';
}

export function Reveal({
    children, as: Tag = 'div', className = '', index = 0, staggerMs = 80, variant = 'fade-up',
}: RevealProps) {
    const { ref, inView } = useInView<HTMLDivElement>();

    return (
        <Tag
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tag is a narrow intrinsic-element union (div/section/li, all HTMLElement-derived); a single HTMLDivElement ref covers them all at runtime.
            ref={ref as any}
            className={`reveal reveal-${variant} ${inView ? 'is-visible' : ''} ${className}`}
            style={{ transitionDelay: inView ? `${index * staggerMs}ms` : '0ms' }}
        >
            {children}
        </Tag>
    );
}

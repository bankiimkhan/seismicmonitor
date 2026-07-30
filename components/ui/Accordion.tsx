"use client";
import { useState } from 'react';
import { ChevronDownIcon } from './icons';

interface AccordionItem {
    title: string;
    content: React.ReactNode;
}

export function Accordion({ items }: { items: AccordionItem[] }) {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <div className="divide-y divide-border">
            {items.map((item, i) => {
                const open = openIndex === i;
                return (
                    <div key={i}>
                        <button
                            type="button"
                            onClick={() => setOpenIndex(open ? null : i)}
                            aria-expanded={open}
                            className="flex w-full items-center justify-between gap-4 py-3 text-left text-sm font-medium text-foreground"
                        >
                            {item.title}
                            <ChevronDownIcon
                                size={14}
                                strokeWidth={2}
                                className={`flex-shrink-0 text-foreground-muted transition-transform duration-[var(--duration-base)] ${open ? 'rotate-180' : ''}`}
                            />
                        </button>
                        {/* Pure-CSS height animation (grid-rows trick) instead of instant conditional render.
                            The overflow:hidden grid item itself must carry no padding of its own -- padding on
                            an element always counts toward its rendered size even under overflow:hidden and a
                            0fr track (only *content* minimum size is zeroed), so it lives one level deeper. */}
                        <div className={`accordion-panel ${open ? 'is-open' : ''}`}>
                            <div>
                                <div className="pb-4 text-sm leading-relaxed text-foreground-muted">{item.content}</div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

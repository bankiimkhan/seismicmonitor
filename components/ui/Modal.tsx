"use client";
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from './icons';

interface ModalProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: string;
    className?: string;
    /** 'center' for standard dialogs/sheets, 'left' for the mobile nav drawer. */
    placement?: 'center' | 'left';
    hideCloseButton?: boolean;
}

export function Modal({ open, onClose, children, title, className = '', placement = 'center', hideCloseButton }: ModalProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    // Everything focusable inside the panel, in DOM order. Recomputed per Tab
    // rather than cached: the drawer's contents (nav links) and any dialog body
    // can change while it is open.
    const focusableInPanel = () =>
        Array.from(
            panelRef.current?.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            ) ?? []
        ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    useEffect(() => {
        if (!open) return;

        // Restored on close so keyboard focus returns to whatever opened the
        // dialog instead of resetting to the top of the document.
        const previouslyFocused = document.activeElement as HTMLElement | null;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }
            // Focus trap. Without this, Tab walked straight out of the panel
            // and into the page behind the backdrop -- which for the mobile nav
            // drawer meant keyboard and screen-reader users lost the menu as
            // soon as they tried to move through it.
            if (e.key !== 'Tab') return;
            const focusable = focusableInPanel();
            if (focusable.length === 0) {
                e.preventDefault();
                panelRef.current?.focus();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            if (e.shiftKey && (active === first || active === panelRef.current)) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        panelRef.current?.focus();

        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = prevOverflow;
            previouslyFocused?.focus?.();
        };
    }, [open, onClose]);

    if (!open || typeof document === 'undefined') return null;

    const isLeft = placement === 'left';

    return createPortal(
        <div className="fixed inset-0 z-[100] flex">
            <div
                className="animate-backdrop-in absolute inset-0 bg-black/75 backdrop-blur-md"
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
                className={`bezel relative z-10 flex flex-col bg-background/97 backdrop-blur-2xl shadow-[var(--glow-lg)] outline-none ${isLeft
                        ? 'animate-drawer-in h-full w-[84vw] max-w-xs rounded-l-none'
                        : 'animate-panel-in m-auto max-h-[85vh] w-[92vw] max-w-lg'
                    } ${className}`}
            >
                {title && (
                    <div className="flex flex-shrink-0 items-center justify-between border-b-2 border-accent/40 px-4 py-3">
                        <h2 className="glow-text text-xs font-bold uppercase tracking-[0.2em] text-accent">{title}</h2>
                        {!hideCloseButton && (
                            <button
                                onClick={onClose}
                                aria-label="Close"
                                className="pad p-1.5 text-foreground-muted hover:text-accent"
                            >
                                <XIcon size={16} />
                            </button>
                        )}
                    </div>
                )}
                <div className="overflow-y-auto">{children}</div>
            </div>
        </div>,
        document.body
    );
}

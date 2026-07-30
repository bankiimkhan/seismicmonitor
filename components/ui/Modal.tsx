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

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        panelRef.current?.focus();
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, onClose]);

    if (!open || typeof document === 'undefined') return null;

    const isLeft = placement === 'left';

    return createPortal(
        <div className="fixed inset-0 z-[100] flex">
            <div
                className="animate-backdrop-in absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
                className={`relative z-10 flex flex-col border border-border bg-surface shadow-xl outline-none ${isLeft
                        ? 'animate-drawer-in h-full w-[84vw] max-w-xs'
                        : 'animate-panel-in m-auto max-h-[85vh] w-[92vw] max-w-lg rounded-xl'
                    } ${className}`}
            >
                {title && (
                    <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-3">
                        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
                        {!hideCloseButton && (
                            <button
                                onClick={onClose}
                                aria-label="Close"
                                className="rounded-md p-1.5 text-foreground-muted transition-colors hover:bg-surface-hover hover:text-foreground"
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

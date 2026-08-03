"use client";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircleIcon, AlertCircleIcon, InfoIcon, XIcon } from './icons';

type ToastTone = 'default' | 'success' | 'error' | 'info';
interface ToastItem {
    id: number;
    message: string;
    tone: ToastTone;
}

const ToastContext = createContext<((message: string, tone?: ToastTone) => void) | null>(null);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}

const TONE_ICON: Record<ToastTone, React.ReactNode> = {
    default: null,
    success: <CheckCircleIcon size={16} className="mt-0.5 flex-shrink-0 text-success" />,
    error: <AlertCircleIcon size={16} className="mt-0.5 flex-shrink-0 text-danger" />,
    info: <InfoIcon size={16} className="mt-0.5 flex-shrink-0 text-accent" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const idRef = useRef(0);
    // The portal target (document.body) doesn't exist during SSR; gating on
    // `typeof document` directly would make the client's first (pre-hydration)
    // render diverge from the server-rendered HTML. Gating on a mounted flag
    // instead keeps both renders identical (nothing) until after hydration.
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
    }, []);

    const dismiss = useCallback((id: number) => {
        setToasts((t) => t.filter((x) => x.id !== id));
    }, []);

    const toast = useCallback((message: string, tone: ToastTone = 'default') => {
        const id = ++idRef.current;
        setToasts((t) => [...t, { id, message, tone }]);
        window.setTimeout(() => dismiss(id), 4000);
    }, [dismiss]);

    return (
        <ToastContext.Provider value={toast}>
            {children}
            {mounted && createPortal(
                <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
                    {toasts.map((t) => (
                        <div
                            key={t.id}
                            role="status"
                            className="bezel animate-toast-in pointer-events-auto flex items-start gap-2.5 bg-background/97 backdrop-blur-xl px-4 py-3 text-xs tracking-wider text-foreground shadow-[var(--glow-md)]"
                        >
                            {TONE_ICON[t.tone]}
                            <span className="flex-1 leading-snug">{t.message}</span>
                            <button
                                onClick={() => dismiss(t.id)}
                                aria-label="Dismiss"
                                className="flex-shrink-0 text-foreground-subtle transition-colors hover:text-foreground"
                            >
                                <XIcon size={14} />
                            </button>
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    );
}

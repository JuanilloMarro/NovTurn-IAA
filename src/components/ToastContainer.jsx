import { useToastStore } from '../store/useToastStore';
import {
    ShieldCheck, ShieldAlert,
    AlertTriangle, AlertCircle, CheckCircle2, X,
} from 'lucide-react';
import { useState, useEffect } from 'react';

// Copiado de NovTurnIA. El mapa de iconos se recortó a los tipos que este
// proyecto emite (ver `useToastStore.js`).
const TOAST_ICONS = {
    factor: <ShieldCheck size={18} />,
    denegado: <ShieldAlert size={18} />,
    validation: <AlertTriangle size={18} />,
    error: <AlertCircle size={18} />,
    success: <CheckCircle2 size={18} />,
};

const TOAST_STYLES = {
    success: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        icon: 'text-emerald-600 bg-emerald-100',
        title: 'text-emerald-900',
        message: 'text-emerald-700',
        bar: 'bg-emerald-500',
    },
    warning: {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: 'text-amber-600 bg-amber-100',
        title: 'text-amber-900',
        message: 'text-amber-700',
        bar: 'bg-amber-500',
    },
    error: {
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        icon: 'text-rose-600 bg-rose-100',
        title: 'text-rose-900',
        message: 'text-rose-700',
        bar: 'bg-rose-500',
    },
};

function SingleToast({ toast, onRemove }) {
    const [isVisible, setIsVisible] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);

    const styles = TOAST_STYLES[toast.status] || TOAST_STYLES.success;

    useEffect(() => {
        requestAnimationFrame(() => setIsVisible(true));
        const exitTimer = setTimeout(() => {
            setIsLeaving(true);
        }, (toast.duration || 4000) - 400);
        return () => clearTimeout(exitTimer);
    }, [toast.duration]);

    const handleClose = () => {
        setIsLeaving(true);
        setTimeout(() => onRemove(toast.id), 300);
    };

    return (
        <div
            className={`
                w-full md:w-[380px] rounded-xl md:rounded-2xl border shadow-[0_8px_30px_rgba(0,0,0,0.08)] overflow-hidden
                transition-all duration-300 ease-out
                ${styles.bg} ${styles.border}
                ${isVisible && !isLeaving
                    ? 'translate-x-0 opacity-100'
                    : 'translate-x-[120%] opacity-0'}
            `}
        >
            <div className="flex items-start gap-2 md:gap-3 p-2.5 md:p-4">
                <div className={`w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl flex items-center justify-center shrink-0 ${styles.icon}`}>
                    {TOAST_ICONS[toast.type] || TOAST_ICONS.success}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                    <div className={`font-bold text-[12px] md:text-[13px] leading-tight ${styles.title}`}>
                        {toast.title}
                    </div>
                    {toast.message && (
                        <div className={`text-[11px] md:text-[12px] font-medium mt-0.5 md:mt-1 truncate ${styles.message}`}>
                            {toast.message}
                        </div>
                    )}
                </div>
                <button
                    onClick={handleClose}
                    className="shrink-0 w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors mt-0.5"
                >
                    <X size={12} className="text-gray-400" />
                </button>
            </div>
            <div className="h-[2px] md:h-[3px] w-full bg-black/5">
                <div
                    className={`h-full ${styles.bar} rounded-full`}
                    style={{ animation: `toast-progress ${toast.duration || 4000}ms linear forwards` }}
                />
            </div>
        </div>
    );
}

export default function ToastContainer() {
    const { toasts, removeToast } = useToastStore();
    if (toasts.length === 0) return null;
    return (
        <div className="fixed top-2 right-2 left-2 md:top-6 md:right-6 md:left-auto z-[500] flex flex-col gap-2 md:gap-3 pointer-events-auto">
            {toasts.map(toast => (
                <SingleToast key={toast.id} toast={toast} onRemove={removeToast} />
            ))}
        </div>
    );
}

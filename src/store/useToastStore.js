import { create } from 'zustand';

// Copiado de NovTurnIA y recortado: allá el store también persistía un registro
// de notificaciones contra `supabaseService`, que en este proyecto no existe.
// El mecanismo de toasts es idéntico.

let toastId = 0;

export const useToastStore = create((set) => ({
    toasts: [],

    addToast: (toast) => {
        const id = ++toastId;
        const newToast = { id, ...toast, duration: toast.duration || 4000 };
        set((state) => ({ toasts: [...state.toasts, newToast] }));
        setTimeout(() => {
            set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }));
        }, newToast.duration);
        return id;
    },

    removeToast: (id) => {
        set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    },
}));

// ── Helper interno ────────────────────────────────────────────────────────────
function toast(status, type, title, message, duration) {
    useToastStore.getState().addToast({ status, type, title, message, ...(duration ? { duration } : {}) });
}

// ── Genéricos ─────────────────────────────────────────────────────────────────
export const showErrorToast = (title, message) => toast('error', 'error', title, message);
export const showSuccessToast = (title, message) => toast('success', 'success', title, message);
export const showWarningToast = (title, message) => toast('warning', 'validation', title, message);

// ── Del proceso de acceso ─────────────────────────────────────────────────────
export const showFactorToast = (title, message) => toast('success', 'factor', title, message);
export const showDenegadoToast = (title, message) => toast('error', 'denegado', title, message, 5000);

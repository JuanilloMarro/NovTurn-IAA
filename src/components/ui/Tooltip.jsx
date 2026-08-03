import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * T19/T20/T21 · Tooltip del sistema.
 *
 * Reemplaza al `title=""` nativo, que tiene tres problemas: **en táctil no
 * existe** (no hay hover, así que el dato simplemente no se puede leer desde el
 * teléfono), no se puede estilar, y aparece con un retardo del sistema
 * operativo que no controlamos.
 *
 * T20 · Comportamiento táctil: en un dispositivo sin hover se abre al tocar y
 * se cierra al tocar afuera, al hacer scroll o con Escape. En escritorio es
 * hover de toda la vida.
 *
 * Va por portal por la misma razón que `Popover`: un ancestro con
 * `backdrop-filter` captura a los `position: fixed`, y las tarjetas de este
 * sistema están llenas de `backdrop-blur` y `overflow-hidden`.
 *
 * Uso:
 *   <Tooltip label="Exportación disponible en Enterprise">
 *       <button …>…</button>
 *   </Tooltip>
 */
export default function Tooltip({ label, children, side = 'top', className = '' }) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState(null);
    const anchorRef = useRef(null);
    const tipRef = useRef(null);

    // `hover: none` es la señal fiable de táctil; `max-width` mentiría en una
    // tablet con teclado y un teléfono en horizontal.
    const esTactil = typeof window !== 'undefined'
        && window.matchMedia?.('(hover: none)').matches;

    useLayoutEffect(() => {
        if (!open) return;

        const place = () => {
            const a = anchorRef.current?.getBoundingClientRect();
            const tip = tipRef.current;
            if (!a || !tip) return;

            const margen = 8;
            const gap = 6;
            const w = tip.offsetWidth;
            const h = tip.offsetHeight;

            let left = a.left + a.width / 2 - w / 2;
            left = Math.min(Math.max(left, margen), window.innerWidth - w - margen);

            // Arriba por defecto; si no cabe, abajo.
            let top = side === 'bottom' ? a.bottom + gap : a.top - gap - h;
            if (top < margen) top = a.bottom + gap;
            if (top + h > window.innerHeight - margen) top = Math.max(margen, a.top - gap - h);

            setPos({ top, left });
        };

        place();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => {
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    }, [open, side]);

    useEffect(() => {
        if (!open) return;
        const cerrar = (e) => {
            if (anchorRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        const escape = (e) => { if (e.key === 'Escape') setOpen(false); };
        // En táctil el cierre es por toque afuera; en escritorio lo maneja el
        // mouseleave, pero registrar esto igual cubre el caso de que el ancla
        // se desmonte con el puntero encima.
        document.addEventListener('touchstart', cerrar);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('touchstart', cerrar);
            document.removeEventListener('keydown', escape);
        };
    }, [open]);

    useEffect(() => { if (!open) setPos(null); }, [open]);

    if (!label) return children;

    const handlers = esTactil
        ? { onClick: () => setOpen(v => !v) }
        : { onMouseEnter: () => setOpen(true), onMouseLeave: () => setOpen(false), onFocus: () => setOpen(true), onBlur: () => setOpen(false) };

    return (
        <>
            <span ref={anchorRef} className={`inline-flex ${className}`} {...handlers}>
                {children}
            </span>
            {open && createPortal(
                <div
                    ref={tipRef}
                    role="tooltip"
                    style={{
                        position: 'fixed',
                        top: pos?.top ?? -9999,
                        left: pos?.left ?? -9999,
                        visibility: pos ? 'visible' : 'hidden',
                    }}
                    className="pointer-events-none max-w-[240px] bg-white/80 backdrop-blur-2xl border border-white/60 rounded-2xl shadow-md px-3 py-2 text-[11px] font-bold text-navy-900 leading-snug z-[400] animate-fade-up"
                >
                    {label}
                </div>,
                document.body
            )}
        </>
    );
}

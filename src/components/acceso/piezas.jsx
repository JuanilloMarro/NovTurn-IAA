import { AlertTriangle, ArrowRight } from 'lucide-react';

/**
 * Piezas compartidas por los cuatro pasos. No estaban en el listado de PLAN.md
 * §4.3; se extrajeron porque los cuatro formularios repetían exactamente el
 * mismo campo, el mismo botón y el mismo aviso de error. Las clases salen de
 * `Login.jsx` de NovTurnIA.
 */

export function CampoTexto({ etiqueta, icono: Icono, accion = null, ...props }) {
    return (
        <div className="space-y-2">
            <label className="text-[10px] font-bold text-navy-900 tracking-wide ml-4 opacity-50 block">
                {etiqueta}
            </label>
            <div className="relative group/input">
                <input
                    {...props}
                    className={`w-full bg-white/40 border border-white/60 rounded-[20px] pl-12 ${accion ? 'pr-12' : 'pr-6'} py-4 text-[16px] sm:text-[13px] outline-none placeholder:text-gray-400 font-semibold text-navy-900 focus:border-white focus:bg-white/60 focus:ring-1 focus:ring-white transition-all shadow-sm relative z-0 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden ${props.className ?? ''}`}
                />
                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-gray-500/80 group-focus-within/input:text-navy-900 transition-colors duration-500 z-10">
                    <Icono size={15} strokeWidth={2.5} />
                </div>
                {accion && (
                    <div className="absolute inset-y-0 right-5 flex items-center z-10">{accion}</div>
                )}
            </div>
        </div>
    );
}

export function BotonPrincipal({ children, cargando = false, ...props }) {
    return (
        <button
            {...props}
            disabled={cargando || props.disabled}
            className="w-full !mt-8 bg-navy-700 hover:bg-navy-900 text-white text-[13px] font-bold py-4 rounded-[22px] shadow-btn hover:shadow-btn-hover hover:scale-[1.01] active:scale-[0.98] transition-all duration-700 disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3 group"
        >
            {cargando ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
                <>
                    <span>{children}</span>
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1 duration-500" />
                </>
            )}
        </button>
    );
}

export function AvisoError({ children }) {
    if (!children) return null;
    return (
        <div className="mb-5 p-3.5 bg-white/40 border border-red-200/60 rounded-[20px] text-[12px] text-red-500 font-semibold flex items-start gap-3">
            <AlertTriangle size={14} strokeWidth={2.5} className="shrink-0 mt-0.5" />
            <span>{children}</span>
        </div>
    );
}

export function BotonSecundario({ children, ...props }) {
    return (
        <button
            {...props}
            className="text-[11px] font-semibold text-navy-700/60 hover:text-navy-900 transition-colors"
        >
            {children}
        </button>
    );
}

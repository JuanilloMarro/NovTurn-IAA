import { Check, Fingerprint, KeyRound, Smartphone, UserSearch } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

/**
 * Las cuatro pastillas del proceso. Hacen visible que identificación y
 * autenticación son etapas distintas — que es justo lo que la práctica evalúa.
 */

const PASTILLAS = [
    { paso: 'identificacion', etiqueta: 'Identificación', factor: null, Icono: UserSearch },
    { paso: 'contrasena', etiqueta: 'Conocimiento', factor: 'conocimiento', Icono: KeyRound },
    { paso: 'biometria', etiqueta: 'Inherencia', factor: 'inherencia', Icono: Fingerprint },
    { paso: 'totp', etiqueta: 'Posesión', factor: 'posesion', Icono: Smartphone },
];

const ORDEN = PASTILLAS.map((p) => p.paso);

export default function IndicadorProgreso() {
    const paso = useAuthStore((s) => s.paso);
    const factores = useAuthStore((s) => s.factores);
    const indiceActual = ORDEN.indexOf(paso);

    return (
        <div className="flex items-stretch gap-1.5 mb-8">
            {PASTILLAS.map(({ paso: p, etiqueta, factor, Icono }, i) => {
                const cumplido = factor ? !!factores[factor] : indiceActual > i || paso === 'autorizacion';
                const activo = p === paso;

                return (
                    <div
                        key={p}
                        className={`
                            flex-1 rounded-[16px] border px-2 py-3 text-center transition-all duration-500
                            ${cumplido
                                ? 'bg-emerald-50/80 border-emerald-200/70'
                                : activo
                                    ? 'bg-white/70 border-white shadow-sm'
                                    : 'bg-white/25 border-white/40'}
                        `}
                    >
                        <div className="flex items-center justify-center mb-1.5">
                            {cumplido
                                ? <Check size={14} strokeWidth={3} className="text-emerald-600" />
                                : <Icono size={14} strokeWidth={2.5} className={activo ? 'text-navy-900' : 'text-gray-400'} />}
                        </div>
                        <div
                            className={`text-[9px] font-bold leading-tight tracking-tight
                                ${cumplido ? 'text-emerald-700' : activo ? 'text-navy-900' : 'text-gray-400'}`}
                        >
                            {etiqueta}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

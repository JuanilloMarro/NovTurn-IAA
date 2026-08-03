import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { supabase } from '../config/supabase';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';

/**
 * Bitácora de accesos. Sólo la ve quien tenga `ver_bitacora`.
 *
 * La guarda de ruta la protege en el cliente, pero la protección real es la
 * política RLS de `access_log`: con la sesión de un rol sin permiso, esta misma
 * consulta devuelve cero filas.
 */

const ETIQUETA_PASO = {
    identificacion: 'Identificación',
    password: 'Contraseña',
    biometria: 'Biometría',
    totp: 'TOTP',
    autorizacion: 'Autorización',
    logout: 'Cierre de sesión',
};

export default function Bitacora() {
    const [filas, setFilas] = useState(null);
    const [error, setError] = useState('');

    async function cargar() {
        setFilas(null);
        setError('');
        const { data, error: err } = await supabase
            .from('access_log')
            .select('id, created_at, email, step, outcome, detail')
            .order('created_at', { ascending: false })
            .limit(200);

        if (err) { setError(err.message); setFilas([]); return; }
        setFilas(data ?? []);
    }

    useEffect(() => { cargar(); }, []);

    return (
        <div className="min-h-[100dvh] safe-area-card py-10 sm:py-14 font-sans relative overflow-hidden">
            <div className="lg-orb hidden sm:block w-[450px] h-[450px] bottom-[-10%] left-[-10%] animate-float-delayed opacity-70" />

            <div className="relative z-10 max-w-5xl mx-auto animate-fade-up">
                <div className="flex items-center justify-between mb-10 gap-4">
                    <div className="min-w-0">
                        <Link
                            to="/panel"
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-navy-700/60 hover:text-navy-900 transition-colors mb-2"
                        >
                            <ArrowLeft size={13} strokeWidth={2.5} /> Volver al panel
                        </Link>
                        <h1 className="text-2xl font-light text-navy-900 tracking-tight">Bitácora de accesos</h1>
                        <p className="text-[11px] text-gray-500 font-medium">
                            Cada paso del proceso, con su resultado y su hora.
                        </p>
                    </div>
                    <button
                        onClick={cargar}
                        className="flex items-center gap-2 bg-white/70 hover:bg-white border border-white/60 hover:border-navy-300 text-gray-600 hover:text-navy-700 text-[12px] font-semibold px-4 py-2.5 rounded-full transition-all shrink-0"
                    >
                        <RefreshCw size={14} strokeWidth={2.5} />
                        Actualizar
                    </button>
                </div>

                <div className="glass-morphism rounded-[32px] p-4 md:p-6 overflow-hidden">
                    {error && (
                        <p className="text-[12px] text-red-500 font-semibold p-4">{error}</p>
                    )}

                    {filas === null && (
                        <div className="space-y-2 p-2">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Skeleton key={i} className="h-12 w-full rounded-[16px]" />
                            ))}
                        </div>
                    )}

                    {filas?.length === 0 && !error && (
                        <p className="text-[12px] text-gray-500 font-medium p-6 text-center">
                            No hay registros todavía, o tu rol no tiene permiso para leerlos.
                        </p>
                    )}

                    {filas && filas.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-separate border-spacing-y-1.5 min-w-[640px]">
                                <thead>
                                    <tr className="text-[10px] font-bold text-navy-900/40 tracking-[0.12em] uppercase">
                                        <th className="px-4 py-2">Hora</th>
                                        <th className="px-4 py-2">Identificador</th>
                                        <th className="px-4 py-2">Paso</th>
                                        <th className="px-4 py-2">Resultado</th>
                                        <th className="px-4 py-2">Detalle</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filas.map((f) => (
                                        <tr key={f.id} className="bg-white/50">
                                            <td className="px-4 py-3 rounded-l-[16px] border-y border-l border-white/70 text-[11px] text-gray-500 font-medium tabular-nums whitespace-nowrap">
                                                {new Date(f.created_at).toLocaleString('es-GT', {
                                                    day: '2-digit', month: '2-digit',
                                                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                                                })}
                                            </td>
                                            <td className="px-4 py-3 border-y border-white/70 text-[12px] font-semibold text-navy-900 whitespace-nowrap">
                                                {f.email ?? '—'}
                                            </td>
                                            <td className="px-4 py-3 border-y border-white/70 text-[12px] font-medium text-gray-600 whitespace-nowrap">
                                                {ETIQUETA_PASO[f.step] ?? f.step}
                                            </td>
                                            <td className="px-4 py-3 border-y border-white/70">
                                                <Badge tone={f.outcome === 'exito' ? 'exito' : 'fallo'}>
                                                    {f.outcome === 'exito' ? 'Éxito' : 'Fallo'}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 rounded-r-[16px] border-y border-r border-white/70 text-[11px] text-gray-500 font-medium">
                                                {f.detail ?? '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

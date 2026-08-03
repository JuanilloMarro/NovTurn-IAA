import { Link } from 'react-router-dom';
import { Check, Fingerprint, KeyRound, LogOut, ScrollText, ShieldCheck, Smartphone } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { usePermisos } from '../hooks/usePermisos';
import { useFlujoAcceso } from '../hooks/useFlujoAcceso';
import Badge from '../components/ui/Badge';

const FACTORES = [
    { clave: 'conocimiento', etiqueta: 'Algo que sé', detalle: 'Contraseña', Icono: KeyRound },
    { clave: 'inherencia', etiqueta: 'Algo que soy', detalle: 'Biometría (WebAuthn)', Icono: Fingerprint },
    { clave: 'posesion', etiqueta: 'Algo que tengo', detalle: 'Código TOTP', Icono: Smartphone },
];

function hora(fecha) {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function Panel() {
    const { perfil, factores } = useAuthStore();
    const { rol, descripcion, verBitacora } = usePermisos();
    const { cerrarSesion } = useFlujoAcceso();

    return (
        <div className="min-h-[100dvh] safe-area-card py-10 px-4 font-sans relative overflow-hidden">
            <div className="lg-orb hidden sm:block w-[500px] h-[500px] top-[-15%] right-[-10%] animate-float opacity-70" />

            <div className="relative z-10 max-w-3xl mx-auto animate-fade-up">
                {/* Encabezado */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-light text-navy-900 tracking-tight">Acceso Seguro</h1>
                        <p className="text-[11px] text-gray-500 font-medium">{perfil?.email}</p>
                    </div>
                    <button
                        onClick={cerrarSesion}
                        className="flex items-center gap-2 bg-white/70 hover:bg-white border border-white/60 hover:border-navy-300 text-gray-600 hover:text-navy-700 text-[12px] font-semibold px-4 py-2.5 rounded-full transition-all"
                    >
                        <LogOut size={14} strokeWidth={2.5} />
                        Cerrar sesión
                    </button>
                </div>

                {/* Resultado de la autorización */}
                <div className="glass-morphism rounded-[32px] p-8 md:p-10 mb-5 text-center relative overflow-hidden">
                    <div className="w-16 h-16 rounded-[24px] bg-emerald-50 border border-emerald-200/70 flex items-center justify-center mx-auto mb-5">
                        <ShieldCheck size={30} strokeWidth={2} className="text-emerald-600" />
                    </div>
                    <p className="text-[11px] font-bold text-emerald-700 tracking-[0.2em] uppercase mb-2">
                        Acceso autorizado
                    </p>
                    <h2 className="text-3xl font-light text-navy-900 tracking-tight mb-1">
                        Rol: <span className="font-semibold">{rol}</span>
                    </h2>
                    <p className="text-[13px] text-gray-500 font-medium max-w-md mx-auto leading-relaxed">
                        {descripcion}
                    </p>
                    <p className="text-[11px] text-gray-400 font-medium mt-4">
                        {perfil?.full_name}
                    </p>
                </div>

                {/* Los tres factores */}
                <div className="glass-morphism rounded-[32px] p-7 md:p-8 mb-5">
                    <h3 className="text-[11px] font-bold text-navy-900/40 tracking-[0.15em] uppercase mb-5">
                        Factores superados
                    </h3>
                    <div className="space-y-3">
                        {FACTORES.map(({ clave, etiqueta, detalle, Icono }) => (
                            <div
                                key={clave}
                                className="flex items-center gap-4 bg-white/50 border border-white/70 rounded-[20px] px-4 py-3.5"
                            >
                                <div className="w-9 h-9 rounded-[14px] bg-emerald-50 border border-emerald-200/60 flex items-center justify-center shrink-0">
                                    <Icono size={16} strokeWidth={2.2} className="text-emerald-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[13px] font-bold text-navy-900">{etiqueta}</div>
                                    <div className="text-[11px] text-gray-500 font-medium">{detalle}</div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="flex items-center gap-1.5 justify-end text-emerald-600">
                                        <Check size={14} strokeWidth={3} />
                                        <span className="text-[11px] font-bold">Verificado</span>
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-medium tabular-nums">
                                        {hora(factores[clave])}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Lo que el rol habilita */}
                <div className="glass-morphism rounded-[32px] p-7 md:p-8">
                    <h3 className="text-[11px] font-bold text-navy-900/40 tracking-[0.15em] uppercase mb-4">
                        Permisos concedidos
                    </h3>
                    <div className="flex flex-wrap gap-2 mb-5">
                        {Object.entries(perfil?.permissions ?? {})
                            .filter(([, valor]) => valor)
                            .map(([clave]) => (
                                <Badge key={clave} tone="exito">
                                    {clave.replace(/_/g, ' ')}
                                </Badge>
                            ))}
                    </div>

                    {verBitacora && (
                        <Link
                            to="/bitacora"
                            className="inline-flex items-center gap-2 bg-navy-700 hover:bg-navy-900 text-white text-[12px] font-bold px-5 py-3 rounded-full shadow-btn hover:shadow-btn-hover transition-all"
                        >
                            <ScrollText size={14} strokeWidth={2.5} />
                            Ver la bitácora de accesos
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}

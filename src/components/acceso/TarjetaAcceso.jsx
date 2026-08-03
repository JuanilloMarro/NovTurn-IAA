import { ShieldCheck } from 'lucide-react';
import AIStar from '../Icons/AIStar';

/**
 * Envoltorio glass compartido por las pantallas del proceso.
 * La estructura visual viene de `Login.jsx` de NovTurnIA: orbes ambientales,
 * tarjeta translúcida, insignia flotante en el borde y `animate-fade-up`.
 */
export default function TarjetaAcceso({ titulo, descripcion, children, pie = null, ancho = 'max-w-md' }) {
    return (
        <div className="min-h-[100dvh] flex items-center justify-center safe-area-card relative overflow-hidden font-sans selection:bg-navy-100/50 py-10">
            {/* Elementos ambientales */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] rounded-full bg-navy-100/10 blur-[120px] pointer-events-none" />
            <div className="lg-orb hidden sm:block w-[500px] h-[500px] top-[-10%] left-[-10%] animate-float opacity-80" />
            <div className="lg-orb hidden sm:block w-[400px] h-[400px] bottom-[-5%] right-[-5%] animate-float-delayed opacity-80" />

            <div className={`relative z-10 w-full ${ancho} animate-fade-up px-4`}>
                <div className="flex flex-col items-center mb-10">
                    <h1 className="text-4xl font-light text-navy-900 tracking-tight text-center">
                        Acceso Seguro
                    </h1>
                    <p className="text-[11px] font-semibold text-navy-700/50 tracking-[0.2em] uppercase mt-2">
                        Identificación · Autenticación · Autorización
                    </p>
                </div>

                <div className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_32px_rgba(26,58,107,0.15),inset_0_2px_4px_rgba(255,255,255,0.8)] rounded-[40px] p-8 md:p-10 relative group">
                    {/* Orbes internos */}
                    <div className="absolute -top-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />
                    <div className="absolute -top-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(29,95,173,0.05)' }} />
                    <div className="absolute -bottom-16 -right-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(120,110,230,0.05)' }} />
                    <div className="absolute -bottom-16 -left-16 pointer-events-none z-0" style={{ width: '55%', height: '55%', borderRadius: '50%', filter: 'blur(60px)', background: 'rgba(64,98,200,0.05)' }} />

                    {/* Insignia flotante */}
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 group-hover:-top-9 transition-all duration-700 ease-out z-20">
                        <div className="w-14 h-14 rounded-[22px] bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_8px_24px_rgba(26,58,107,0.10)] flex items-center justify-center">
                            <div className="relative">
                                <ShieldCheck size={28} className="text-navy-900" strokeWidth={2.2} />
                                <AIStar size={11} className="absolute -top-1 -left-1 text-navy-900" strokeWidth={2.5} />
                            </div>
                        </div>
                    </div>

                    <div className="relative z-10">
                        <div className="mb-7 text-center px-2 pt-2">
                            <h2 className="text-lg font-bold text-navy-900 tracking-tight mb-1.5">{titulo}</h2>
                            {descripcion && (
                                <p className="text-gray-500 text-[12px] font-medium leading-relaxed">
                                    {descripcion}
                                </p>
                            )}
                        </div>
                        {children}
                    </div>
                </div>

                {pie && <div className="mt-6 text-center">{pie}</div>}
            </div>
        </div>
    );
}

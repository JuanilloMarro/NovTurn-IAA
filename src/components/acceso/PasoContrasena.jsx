import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useFlujoAcceso } from '../../hooks/useFlujoAcceso';
import { AvisoError, BotonPrincipal, BotonSecundario, CampoTexto } from './piezas';

/**
 * Paso 2 — Contraseña. Factor de CONOCIMIENTO ("algo que sé"). PLAN.md §5.3.
 * Al superarlo la sesión queda en AAL1 y se fija `idEsperado`, que el paso 3
 * compara contra el dueño de la passkey.
 */
export default function PasoContrasena() {
    const [password, setPassword] = useState('');
    const [visible, setVisible] = useState(false);
    const { error, cargando, nombre, email } = useAuthStore();
    const { verificarContrasena } = useFlujoAcceso();
    const reiniciar = useAuthStore((s) => s.reiniciarFlujo);

    function enviar(e) {
        e.preventDefault();
        verificarContrasena(password);
        setPassword('');
    }

    return (
        <form onSubmit={enviar} className="space-y-5">
            <div className="mb-5 p-3.5 bg-white/50 border border-white/70 rounded-[20px] text-center">
                <div className="text-[10px] font-bold text-navy-900/40 tracking-wide uppercase">
                    Identificado como
                </div>
                <div className="text-[14px] font-bold text-navy-900 mt-0.5">
                    {nombre || email}
                </div>
                {nombre && <div className="text-[11px] text-gray-500 font-medium">{email}</div>}
            </div>

            <AvisoError>{error}</AvisoError>

            <CampoTexto
                etiqueta="Contraseña · algo que sé"
                icono={Lock}
                type={visible ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                autoComplete="current-password"
                placeholder="••••••••"
                accion={
                    <button
                        type="button"
                        onClick={() => setVisible(!visible)}
                        className="text-gray-500/80 hover:text-navy-700 transition-colors duration-300"
                        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                        {visible ? <EyeOff size={15} strokeWidth={2.5} /> : <Eye size={15} strokeWidth={2.5} />}
                    </button>
                }
            />

            <BotonPrincipal type="submit" cargando={cargando}>
                Verificar contraseña
            </BotonPrincipal>

            <div className="text-center pt-1">
                <BotonSecundario type="button" onClick={() => reiniciar()}>
                    Usar otro identificador
                </BotonSecundario>
            </div>
        </form>
    );
}

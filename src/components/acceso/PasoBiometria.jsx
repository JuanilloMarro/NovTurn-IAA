import { Fingerprint } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useFlujoAcceso } from '../../hooks/useFlujoAcceso';
import { AvisoError, BotonPrincipal } from './piezas';

/**
 * Paso 3 — Biometría. Factor de INHERENCIA ("algo que soy"). PLAN.md §5.4.
 *
 * Va antes que el TOTP a propósito: verificar la passkey emite una sesión nueva
 * en AAL1, así que si el TOTP fuera antes, esta sesión lo anularía.
 */
export default function PasoBiometria() {
    const { error, cargando, nombre, email } = useAuthStore();
    const { verificarBiometria } = useFlujoAcceso();

    return (
        <div className="space-y-5">
            <AvisoError>{error}</AvisoError>

            <div className="flex flex-col items-center py-4">
                <div
                    className={`w-20 h-20 rounded-[28px] bg-white/50 border border-white/70 flex items-center justify-center shadow-sm transition-all duration-700
                        ${cargando ? 'scale-110 border-navy-300' : ''}`}
                >
                    <Fingerprint
                        size={38}
                        strokeWidth={1.8}
                        className={`text-navy-900 transition-opacity duration-700 ${cargando ? 'opacity-40' : 'opacity-90'}`}
                    />
                </div>
                <p className="text-[12px] text-gray-500 font-medium text-center mt-5 leading-relaxed max-w-[280px]">
                    Confirmá tu identidad con la huella, el rostro o el PIN del
                    dispositivo. Se abrirá el autenticador del sistema.
                </p>
            </div>

            <BotonPrincipal type="button" cargando={cargando} onClick={verificarBiometria}>
                Verificar biometría
            </BotonPrincipal>

            <p className="text-[10px] text-gray-400 font-medium text-center leading-relaxed pt-1">
                La credencial debe pertenecer a <span className="font-bold">{nombre || email}</span>.
                Si pertenece a otra cuenta, el acceso se deniega y el intento queda en la bitácora.
            </p>
        </div>
    );
}

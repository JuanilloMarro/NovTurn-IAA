import { useState } from 'react';
import { Smartphone } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useFlujoAcceso } from '../../hooks/useFlujoAcceso';
import { AvisoError, BotonPrincipal, CampoTexto } from './piezas';

/**
 * Paso 4 — TOTP. Factor de POSESIÓN ("algo que tengo"). PLAN.md §5.5.
 * Es el único paso que eleva la sesión de AAL1 a AAL2, y por eso va al final.
 */
export default function PasoTotp() {
    const [codigo, setCodigo] = useState('');
    const { error, cargando } = useAuthStore();
    const { verificarTotp } = useFlujoAcceso();

    function enviar(e) {
        e.preventDefault();
        verificarTotp(codigo.trim());
        setCodigo('');
    }

    return (
        <form onSubmit={enviar} className="space-y-6">
            <AvisoError>{error}</AvisoError>

            <CampoTexto
                etiqueta="Código de seis dígitos"
                icono={Smartphone}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                required
                autoFocus
                autoComplete="one-time-code"
                placeholder="000000"
                className="tracking-[0.5em] text-center !pl-12 !pr-6"
            />

            <BotonPrincipal type="submit" cargando={cargando} disabled={codigo.length !== 6}>
                Verificar código
            </BotonPrincipal>

            <p className="text-[10px] text-gray-400 font-medium text-center leading-relaxed pt-1">
                El código cambia cada 30 segundos.
            </p>
        </form>
    );
}

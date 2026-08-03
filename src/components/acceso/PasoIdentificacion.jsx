import { useState } from 'react';
import { Mail } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useFlujoAcceso } from '../../hooks/useFlujoAcceso';
import { AvisoError, BotonPrincipal, CampoTexto } from './piezas';

/**
 * Paso 1 — Identificación. PLAN.md §5.2.
 * Es la etapa que la práctica evalúa por separado de la autenticación: acá el
 * sistema sólo averigua *quién dice ser* el usuario, sin comprobar nada todavía.
 */
export default function PasoIdentificacion() {
    const [correo, setCorreo] = useState('');
    const { error, cargando } = useAuthStore();
    const { identificar } = useFlujoAcceso();

    function enviar(e) {
        e.preventDefault();
        identificar(correo);
    }

    return (
        <form onSubmit={enviar} className="space-y-6">
            <AvisoError>{error}</AvisoError>

            <CampoTexto
                etiqueta="Identificador · correo electrónico"
                icono={Mail}
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                placeholder="usuario@accesoseguro.gt"
            />

            <BotonPrincipal type="submit" cargando={cargando}>
                Continuar
            </BotonPrincipal>
        </form>
    );
}

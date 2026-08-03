import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useFlujoAcceso } from '../hooks/useFlujoAcceso';
import IndicadorProgreso from '../components/acceso/IndicadorProgreso';
import TarjetaAcceso from '../components/acceso/TarjetaAcceso';
import PasoIdentificacion from '../components/acceso/PasoIdentificacion';
import PasoContrasena from '../components/acceso/PasoContrasena';
import PasoBiometria from '../components/acceso/PasoBiometria';
import PasoTotp from '../components/acceso/PasoTotp';

/** Orquesta los cinco pasos. El quinto no tiene pantalla: se resuelve solo. */

const TEXTOS = {
    identificacion: {
        titulo: 'Identificación',
        descripcion: 'Primero el sistema necesita saber quién decís ser. Todavía no se comprueba nada.',
    },
    contrasena: {
        titulo: 'Primer factor · algo que sé',
        descripcion: 'Ahora sí empieza la autenticación: probá que conocés la contraseña de esta cuenta.',
    },
    biometria: {
        titulo: 'Segundo factor · algo que soy',
        descripcion: 'Verificá tu identidad con la biometría del dispositivo.',
    },
    totp: {
        titulo: 'Tercer factor · algo que tengo',
        descripcion: 'Ingresá el código de tu autenticador para elevar la sesión a AAL2.',
    },
    autorizacion: {
        titulo: 'Autorización',
        descripcion: 'Los tres factores están superados. Determinando el rol y los permisos…',
    },
};

export default function Acceso() {
    const paso = useAuthStore((s) => s.paso);
    const { autorizar } = useFlujoAcceso();
    const yaAutorizando = useRef(false);

    // El paso 5 no pide nada al usuario: en cuanto los tres factores están
    // superados se consulta el rol y se entra al panel.
    useEffect(() => {
        if (paso === 'autorizacion' && !yaAutorizando.current) {
            yaAutorizando.current = true;
            autorizar();
        }
        if (paso !== 'autorizacion') yaAutorizando.current = false;
    }, [paso, autorizar]);

    const { titulo, descripcion } = TEXTOS[paso] ?? TEXTOS.identificacion;

    return (
        <TarjetaAcceso
            titulo={titulo}
            descripcion={descripcion}
            pie={
                <Link
                    to="/enrolamiento"
                    className="text-[11px] font-semibold text-navy-700/50 hover:text-navy-900 transition-colors"
                >
                    Registrar mis factores de autenticación
                </Link>
            }
        >
            <IndicadorProgreso />

            {paso === 'identificacion' && <PasoIdentificacion />}
            {paso === 'contrasena' && <PasoContrasena />}
            {paso === 'biometria' && <PasoBiometria />}
            {paso === 'totp' && <PasoTotp />}
            {paso === 'autorizacion' && (
                <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-navy-300/40 border-t-navy-700 rounded-full animate-spin" />
                </div>
            )}
        </TarjetaAcceso>
    );
}

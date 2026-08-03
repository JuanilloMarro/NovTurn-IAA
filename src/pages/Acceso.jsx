import { useEffect, useRef } from 'react';
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
        descripcion: 'Ingresá tu identificador para comenzar.',
    },
    contrasena: {
        titulo: 'Contraseña',
        descripcion: 'Ingresá la contraseña de tu cuenta.',
    },
    biometria: {
        titulo: 'Biometría',
        descripcion: 'Verificá tu identidad con el dispositivo.',
    },
    totp: {
        titulo: 'Autenticador',
        descripcion: 'Ingresá el código de tu aplicación de autenticación.',
    },
    autorizacion: {
        titulo: 'Autorización',
        descripcion: 'Verificando tus permisos…',
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
        // Ya no hay enlace al registro de factores: se llega ahí desde el paso
        // de contraseña, nunca por fuera del proceso.
        <TarjetaAcceso titulo={titulo} descripcion={descripcion}>
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

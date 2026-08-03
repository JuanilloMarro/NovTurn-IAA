import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { supabase } from './config/supabase';
import { useAuthStore } from './store/useAuthStore';
import { usePermisos } from './hooks/usePermisos';
import { showDenegadoToast } from './store/useToastStore';
import ToastContainer from './components/ToastContainer';
import Acceso from './pages/Acceso';
import Panel from './pages/Panel';
import Bitacora from './pages/Bitacora';
import Enrolamiento from './pages/Enrolamiento';

/**
 * Guarda de sesión — PLAN.md §5.7.
 *
 * Comprueba DOS cosas, no una: que haya sesión y que el nivel de garantía sea
 * `aal2`. Sin lo segundo, una sesión que sólo superó la contraseña entraría al
 * panel y los otros dos factores serían decorativos.
 */
function RutaProtegida({ children }) {
    const [estado, setEstado] = useState('comprobando'); // comprobando | permitido | denegado
    const perfil = useAuthStore((s) => s.perfil);
    const setPerfil = useAuthStore((s) => s.setPerfil);
    const setAal = useAuthStore((s) => s.setAal);

    useEffect(() => {
        let vigente = true;

        (async () => {
            const { data: { session } } = await supabase.auth.getSession();
            const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

            if (!session || nivel?.currentLevel !== 'aal2') {
                if (vigente) setEstado('denegado');
                return;
            }

            // Tras recargar la página la sesión sobrevive pero el store se
            // reinicia: hay que volver a pedir el rol antes de pintar el panel.
            if (!perfil) {
                const { data } = await supabase.rpc('mi_perfil');
                if (!data) { if (vigente) setEstado('denegado'); return; }
                if (vigente) setPerfil(data);
            }

            if (vigente) {
                setAal(nivel.currentLevel);
                setEstado('permitido');
            }
        })();

        return () => { vigente = false; };
        // `perfil` se lee una vez al montar a propósito: reejecutar al fijarlo
        // volvería a disparar la comprobación sin necesidad.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (estado === 'comprobando') {
        return (
            <div className="min-h-[100dvh] flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-navy-300/40 border-t-navy-700 rounded-full animate-spin" />
            </div>
        );
    }
    if (estado === 'denegado') return <Navigate to="/acceso" replace />;
    return children;
}

/**
 * Guarda de autorización. El permiso se consulta en el perfil que vino de la
 * base, nunca comparando el nombre del rol.
 */
function RequierePermiso({ permiso, children }) {
    const permisos = usePermisos();
    const concedido = permisos[permiso];

    useEffect(() => {
        if (!concedido) {
            showDenegadoToast('Acceso denegado', 'No tenés permiso para ver la bitácora');
        }
    }, [concedido]);

    if (!concedido) return <Navigate to="/panel" replace />;
    return children;
}

export default function App() {
    return (
        <>
            <ToastContainer />
            <Routes>
                <Route path="/acceso" element={<Acceso />} />
                <Route path="/enrolamiento" element={<Enrolamiento />} />

                <Route
                    path="/panel"
                    element={<RutaProtegida><Panel /></RutaProtegida>}
                />
                <Route
                    path="/bitacora"
                    element={
                        <RutaProtegida>
                            <RequierePermiso permiso="verBitacora">
                                <Bitacora />
                            </RequierePermiso>
                        </RutaProtegida>
                    }
                />

                <Route path="*" element={<Navigate to="/acceso" replace />} />
            </Routes>
        </>
    );
}

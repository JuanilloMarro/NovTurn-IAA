import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, MODO_DEMO } from '../config/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { showDenegadoToast, showFactorToast } from '../store/useToastStore';

/**
 * LA MÁQUINA DE ESTADOS — PLAN.md §5.
 *
 *   1. IDENTIFICACIÓN  correo          → ¿existe? ¿está activo?
 *   2. CONTRASEÑA      algo que SÉ     → signInWithPassword     → sesión AAL1
 *   3. BIOMETRÍA       algo que SOY    → passkey (WebAuthn)     → sesión nueva AAL1
 *   4. TOTP            algo que TENGO  → mfa.challenge + verify → sesión AAL2
 *   5. AUTORIZACIÓN    rol y permisos  → mi_perfil()
 *
 * Por qué la biometría va ANTES que el TOTP: verificar una passkey emite una
 * sesión nueva que reemplaza la anterior. Si el TOTP fuera antes, esa sesión
 * nueva volvería a AAL1 y la aplicación pediría el TOTP otra vez. Poniéndolo al
 * final, el AAL2 queda reflejado en el token que se usa de ahí en adelante.
 * (PLAN.md §5.1 — no reordenar sin entender esto.)
 */

/** Deja constancia en `access_log`. Cada paso se registra, salga bien o mal. */
async function registrar(email, step, outcome, detail) {
    const { error } = await supabase.rpc('registrar_evento', {
        p_email: email,
        p_step: step,
        p_outcome: outcome,
        p_detail: detail ?? null,
    });
    // Que falle la bitácora no debe tumbar el flujo, pero sí tiene que verse.
    if (error) console.error('No se pudo registrar el evento:', error.message);
}

export function useFlujoAcceso() {
    const navigate = useNavigate();
    const {
        email, idEsperado,
        setCargando, setError, setAal, setPerfil,
        identificado, factorSuperado, setIdEsperado, setPaso,
        reiniciarFlujo, limpiar,
    } = useAuthStore();

    // ── Paso 1 · Identificación ───────────────────────────────────────────────
    const identificar = useCallback(async (correo) => {
        setCargando(true);
        const limpio = correo.trim();

        // Con la bandera apagada no se consulta si el correo existe: se pasa
        // directo a la contraseña y el error de más adelante es genérico, que es
        // lo correcto en producción. La enumeración de usuarios es un requisito
        // de la práctica, no una buena idea. (PLAN.md §3.4)
        if (!MODO_DEMO) {
            identificado({ email: limpio, nombre: '' });
            return;
        }

        const { data, error } = await supabase.rpc('identificar_usuario', { p_email: limpio });

        if (error) {
            setError('No se pudo consultar el identificador. Intentá de nuevo.');
            return;
        }
        if (!data?.existe) {
            setError('No existe una cuenta con ese identificador.');
            return;
        }
        if (!data.activo) {
            setError('La cuenta existe pero está desactivada. Contactá al administrador.');
            return;
        }

        identificado({ email: limpio, nombre: data.nombre });
    }, [identificado, setCargando, setError]);

    // ── Paso 2 · Contraseña (algo que SÉ) ─────────────────────────────────────
    const verificarContrasena = useCallback(async (password) => {
        setCargando(true);

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            await registrar(email, 'password', 'fallo', error.message);
            setError('Contraseña incorrecta.');
            return;
        }

        // Se guarda el identificador de quien acaba de probar que sabe la
        // contraseña. El paso 3 lo compara: sin esto, la huella de otra cuenta
        // dejaría entrar.
        setIdEsperado(data.user.id);

        const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        setAal(nivel?.currentLevel ?? 'aal1');

        await registrar(email, 'password', 'exito', 'Factor conocimiento superado');
        showFactorToast('Conocimiento verificado', 'Contraseña correcta');
        factorSuperado('conocimiento', 'biometria');
    }, [email, factorSuperado, setAal, setCargando, setError, setIdEsperado]);

    // ── Paso 3 · Biometría (algo que SOY) ─────────────────────────────────────
    const verificarBiometria = useCallback(async () => {
        setCargando(true);

        // `signInWithPasskey()` ejecuta la ceremonia WebAuthn completa: pide el
        // reto al servidor, invoca `navigator.credentials.get()` —que abre
        // Windows Hello, Touch ID o la huella del teléfono— y verifica la
        // credencial. Verificado en el .d.ts de @supabase/auth-js 2.111.0.
        // El PLAN contemplaba la API de dos pasos; en esta versión sus
        // ayudantes de serialización (`serializeCredentialRequestResponse` y
        // compañía) no se reexportan desde @supabase/supabase-js, así que la
        // forma de dos pasos obligaría a importar rutas internas del paquete.
        // El control de identidad de abajo funciona igual con las dos.
        const { data, error } = await supabase.auth.signInWithPasskey();

        if (error) {
            await registrar(email, 'biometria', 'fallo', error.message);
            setError('No se pudo verificar la biometría. Volvé a intentarlo.');
            return;
        }

        // ── CONTROL CRÍTICO ───────────────────────────────────────────────────
        // Las passkeys de Supabase son credenciales descubribles: el autenticador
        // muestra una lista de cuentas y el usuario elige. Sin esta comparación,
        // alguien podría superar los pasos 1 y 2 como `admin@` y luego poner la
        // huella de `usuario@` y quedar dentro.
        if (data.user?.id !== idEsperado) {
            await supabase.auth.signOut();
            await registrar(email, 'biometria', 'fallo', 'La huella pertenece a otra cuenta');
            showDenegadoToast(
                'Acceso denegado',
                'La biometría no corresponde al usuario identificado',
            );
            reiniciarFlujo('La biometría no corresponde al usuario identificado.');
            return;
        }

        // La sesión que emite la passkey es nueva y vuelve a AAL1: es
        // exactamente el motivo por el que el TOTP va después.
        const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        setAal(nivel?.currentLevel ?? 'aal1');

        await registrar(email, 'biometria', 'exito', 'Factor inherencia superado');
        showFactorToast('Inherencia verificada', 'Biometría correcta');
        factorSuperado('inherencia', 'totp');
    }, [email, idEsperado, factorSuperado, reiniciarFlujo, setAal, setCargando, setError]);

    // ── Paso 4 · TOTP (algo que TENGO) ────────────────────────────────────────
    const verificarTotp = useCallback(async (codigo) => {
        setCargando(true);

        const { data: factores, error: errFactores } = await supabase.auth.mfa.listFactors();
        if (errFactores) {
            setError('No se pudieron leer los factores registrados.');
            return;
        }

        const totp = (factores?.totp ?? []).find((f) => f.status === 'verified')
            ?? (factores?.totp ?? [])[0];

        if (!totp) {
            setError('Esta cuenta no tiene un autenticador registrado.');
            navigate('/enrolamiento');
            return;
        }

        const { data: reto, error: errReto } = await supabase.auth.mfa.challenge({ factorId: totp.id });
        if (errReto) {
            await registrar(email, 'totp', 'fallo', errReto.message);
            setError('No se pudo generar el reto del autenticador.');
            return;
        }

        const { error: errVerify } = await supabase.auth.mfa.verify({
            factorId: totp.id,
            challengeId: reto.id,
            code: codigo,
        });

        if (errVerify) {
            await registrar(email, 'totp', 'fallo', errVerify.message);
            setError('Código incorrecto o vencido.');
            return;
        }

        const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        setAal(nivel?.currentLevel ?? null);

        await registrar(email, 'totp', 'exito', `Factor posesión superado. AAL: ${nivel?.currentLevel}`);
        showFactorToast('Posesión verificada', `Nivel de garantía: ${nivel?.currentLevel?.toUpperCase()}`);
        factorSuperado('posesion', 'autorizacion');
    }, [email, factorSuperado, navigate, setAal, setCargando, setError]);

    // ── Paso 5 · Autorización ─────────────────────────────────────────────────
    const autorizar = useCallback(async () => {
        setCargando(true);

        const { data: perfil, error } = await supabase.rpc('mi_perfil');

        if (error || !perfil) {
            await registrar(email, 'autorizacion', 'fallo', 'Sin perfil asignado');
            await supabase.auth.signOut();
            reiniciarFlujo('Tu cuenta no tiene un perfil asignado en el sistema.');
            return;
        }

        setPerfil(perfil);
        await registrar(perfil.email, 'autorizacion', 'exito', `Rol concedido: ${perfil.role_name}`);
        setCargando(false);
        navigate('/panel');
    }, [email, navigate, reiniciarFlujo, setCargando, setPerfil]);

    // ── Cierre de sesión ──────────────────────────────────────────────────────
    const cerrarSesion = useCallback(async () => {
        const { perfil } = useAuthStore.getState();
        // El evento se registra ANTES de cerrar: `registrar_evento` usa
        // `auth.uid()` y después del signOut ya no hay sesión de la que leerlo.
        await registrar(perfil?.email ?? email, 'logout', 'exito', 'Sesión cerrada por el usuario');
        await supabase.auth.signOut();
        limpiar();
        navigate('/acceso');
    }, [email, limpiar, navigate]);

    return {
        identificar,
        verificarContrasena,
        verificarBiometria,
        verificarTotp,
        autorizar,
        cerrarSesion,
        setPaso,
    };
}

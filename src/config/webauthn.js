/**
 * Ceremonia WebAuthn con el autenticador del propio dispositivo.
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 *
 * `supabase.auth.registerPasskey()` y `signInWithPasskey()` ejecutan la ceremonia
 * por su cuenta, pero le imponen al navegador estas opciones (constantes
 * `DEFAULT_CREATION_OPTIONS` y `DEFAULT_REQUEST_OPTIONS` de @supabase/auth-js
 * 2.111.0, en `lib/webauthn.js`):
 *
 *     hints: ['security-key'],
 *     authenticatorSelection: {
 *         authenticatorAttachment: 'cross-platform',
 *         residentKey: 'discouraged',
 *         userVerification: 'preferred',
 *     }
 *
 * `cross-platform` le pide al navegador que EXCLUYA el autenticador integrado
 * del dispositivo, y `hints: ['security-key']` lo orienta a llaves USB. El
 * resultado en iOS es que Safari sólo ofrece "escanear código" (usar otro
 * aparato) y "usar llave de seguridad": nunca Face ID. La librería está afinada
 * para YubiKeys — su propio comentario menciona "older yubikeys".
 *
 * Para una práctica sobre los tres factores eso es justo lo contrario de lo que
 * se quiere: un QR o una llave USB son "algo que TENGO", no "algo que SOY", y
 * duplicarían el factor de posesión que ya cubre el TOTP.
 *
 * Ninguno de los dos métodos de alto nivel acepta sobrescribir esas opciones, y
 * los ayudantes internos de auth-js no se reexportan desde
 * @supabase/supabase-js. Por eso la ceremonia se hace acá, usando la API de dos
 * pasos (`passkey.startRegistration` / `verifyRegistration` y
 * `startAuthentication` / `verifyAuthentication`), que es lo que PLAN.md §5.4
 * indicaba desde el principio.
 */

/** Opciones que fuerzan biometría del propio dispositivo al REGISTRAR. */
const REGISTRO_PLATAFORMA = {
    authenticatorSelection: {
        // Sólo el autenticador integrado: Face ID, Touch ID, Windows Hello.
        authenticatorAttachment: 'platform',
        // Credencial descubrible: hace falta para iniciar sesión sin escribir
        // el usuario, que es como funciona el paso 3 del flujo.
        residentKey: 'required',
        requireResidentKey: true,
        // 'required' obliga a comprobar al usuario (rostro, huella o PIN). Con
        // 'preferred' un autenticador podría limitarse a detectar presencia.
        userVerification: 'required',
    },
    hints: ['client-device'],
};

/** Opciones que fuerzan biometría del propio dispositivo al AUTENTICAR. */
const AUTENTICACION_PLATAFORMA = {
    userVerification: 'required',
    hints: ['client-device'],
};

// ── Conversión base64url ↔ binario ────────────────────────────────────────────
// Sólo se usan como respaldo: los navegadores con WebAuthn nivel 3 (Safari 17.4+,
// Chrome 119+) traen `parseCreationOptionsFromJSON` y `toJSON`, que hacen esto
// mismo de forma nativa.

function base64urlABytes(valor) {
    const base64 = valor.replace(/-/g, '+').replace(/_/g, '/');
    const relleno = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const binario = atob(relleno);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return bytes;
}

function bytesABase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binario = '';
    for (let i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i]);
    return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function convertirDescriptores(lista) {
    return (lista ?? []).map((c) => ({ ...c, id: base64urlABytes(c.id) }));
}

// ── Ceremonias ────────────────────────────────────────────────────────────────

/** ¿El navegador soporta WebAuthn? */
export function soportaWebAuthn() {
    return typeof window !== 'undefined'
        && typeof window.PublicKeyCredential !== 'undefined'
        && typeof navigator.credentials?.create === 'function';
}

/**
 * Registra una credencial con el autenticador integrado del dispositivo.
 * @param {object} opcionesJson opciones que devolvió `passkey.startRegistration()`
 * @returns credencial serializada, lista para `passkey.verifyRegistration()`
 */
export async function crearCredencialBiometrica(opcionesJson) {
    // Las opciones se sobrescriben mientras siguen siendo JSON plano: los campos
    // que tocamos no son binarios, así que es más simple que hacerlo después.
    const json = {
        ...opcionesJson,
        ...REGISTRO_PLATAFORMA,
        authenticatorSelection: {
            ...(opcionesJson.authenticatorSelection ?? {}),
            ...REGISTRO_PLATAFORMA.authenticatorSelection,
        },
    };

    let publicKey;
    if (typeof window.PublicKeyCredential.parseCreationOptionsFromJSON === 'function') {
        publicKey = window.PublicKeyCredential.parseCreationOptionsFromJSON(json);
    } else {
        publicKey = {
            ...json,
            challenge: base64urlABytes(json.challenge),
            user: { ...json.user, id: base64urlABytes(json.user.id) },
            excludeCredentials: convertirDescriptores(json.excludeCredentials),
        };
    }

    const credencial = await navigator.credentials.create({ publicKey });
    if (!credencial) throw new Error('El autenticador no devolvió ninguna credencial.');

    if (typeof credencial.toJSON === 'function') return credencial.toJSON();
    return {
        id: credencial.id,
        rawId: credencial.id,
        type: 'public-key',
        response: {
            attestationObject: bytesABase64url(credencial.response.attestationObject),
            clientDataJSON: bytesABase64url(credencial.response.clientDataJSON),
        },
        clientExtensionResults: credencial.getClientExtensionResults(),
        authenticatorAttachment: credencial.authenticatorAttachment ?? undefined,
    };
}

/**
 * Verifica al usuario con el autenticador integrado del dispositivo.
 * @param {object} opcionesJson opciones que devolvió `passkey.startAuthentication()`
 * @returns credencial serializada, lista para `passkey.verifyAuthentication()`
 */
export async function obtenerCredencialBiometrica(opcionesJson) {
    const json = { ...opcionesJson, ...AUTENTICACION_PLATAFORMA };

    let publicKey;
    if (typeof window.PublicKeyCredential.parseRequestOptionsFromJSON === 'function') {
        publicKey = window.PublicKeyCredential.parseRequestOptionsFromJSON(json);
    } else {
        publicKey = {
            ...json,
            challenge: base64urlABytes(json.challenge),
            allowCredentials: convertirDescriptores(json.allowCredentials),
        };
    }

    const credencial = await navigator.credentials.get({ publicKey });
    if (!credencial) throw new Error('El autenticador no devolvió ninguna credencial.');

    if (typeof credencial.toJSON === 'function') return credencial.toJSON();
    return {
        id: credencial.id,
        rawId: credencial.id,
        type: 'public-key',
        response: {
            authenticatorData: bytesABase64url(credencial.response.authenticatorData),
            clientDataJSON: bytesABase64url(credencial.response.clientDataJSON),
            signature: bytesABase64url(credencial.response.signature),
            userHandle: credencial.response.userHandle
                ? bytesABase64url(credencial.response.userHandle)
                : undefined,
        },
        clientExtensionResults: credencial.getClientExtensionResults(),
        authenticatorAttachment: credencial.authenticatorAttachment ?? undefined,
    };
}

/** Traduce los errores de WebAuthn a algo que se entienda en pantalla. */
export function mensajeDeError(err) {
    switch (err?.name) {
        case 'NotAllowedError':
            return 'Se canceló la verificación biométrica o se agotó el tiempo.';
        case 'InvalidStateError':
            return 'Este dispositivo ya tiene una credencial registrada para esta cuenta.';
        case 'NotSupportedError':
            return 'Este dispositivo no tiene un autenticador biométrico compatible.';
        case 'SecurityError':
            return 'El dominio no coincide con el configurado para las passkeys (Relying Party ID).';
        default:
            return err?.message ?? 'No se pudo completar la ceremonia biométrica.';
    }
}

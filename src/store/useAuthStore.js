import { create } from 'zustand';

/**
 * Estado del proceso de acceso.
 *
 * Los cinco pasos de PLAN.md §5.1. `idEsperado` es el control que hace que la
 * biometría no pueda pertenecer a otra cuenta: se fija en el paso 2 y se compara
 * en el paso 3.
 */

export const PASOS = ['identificacion', 'contrasena', 'biometria', 'totp', 'autorizacion'];

const ESTADO_INICIAL = {
    paso: 'identificacion',

    // Identificación
    email: '',
    nombre: '',

    // Fijado por la contraseña, comprobado por la biometría
    idEsperado: null,

    // Factores superados: cada uno guarda la hora en que se cumplió
    factores: {
        conocimiento: null,
        inherencia: null,
        posesion: null,
    },

    // Nivel de garantía del autenticador, tal como lo reporta Supabase
    aal: null,

    // Autorización
    perfil: null,

    error: '',
    cargando: false,
};

export const useAuthStore = create((set) => ({
    ...ESTADO_INICIAL,

    setPaso: (paso) => set({ paso, error: '' }),
    setError: (error) => set({ error, cargando: false }),
    setCargando: (cargando) => set({ cargando }),
    setAal: (aal) => set({ aal }),
    setPerfil: (perfil) => set({ perfil }),

    identificado: ({ email, nombre }) =>
        set({ email, nombre, paso: 'contrasena', error: '', cargando: false }),

    factorSuperado: (clave, siguientePaso) =>
        set((s) => ({
            factores: { ...s.factores, [clave]: new Date() },
            paso: siguientePaso ?? s.paso,
            error: '',
            cargando: false,
        })),

    setIdEsperado: (idEsperado) => set({ idEsperado }),

    /** Vuelve al paso 1 sin perder el correo ya escrito. */
    reiniciarFlujo: (error = '') =>
        set({ ...ESTADO_INICIAL, error }),

    /** Limpia todo, incluido el perfil. Para el cierre de sesión. */
    limpiar: () => set({ ...ESTADO_INICIAL }),
}));

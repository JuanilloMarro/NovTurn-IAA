import { createClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase.
 *
 * `experimental.passkey` es obligatorio: sin él, el espacio de nombres
 * `supabase.auth.passkey` y los métodos `signInWithPasskey` / `registerPasskey`
 * lanzan una excepción (`assertPasskeyExperimentalEnabled` en auth-js).
 *
 * Verificado contra @supabase/auth-js 2.111.0.
 */
export const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    { auth: { experimental: { passkey: true } } },
);

/** Bandera de la práctica. Ver PLAN.md §3.4 y §5.2. */
export const MODO_DEMO = import.meta.env.VITE_MODO_DEMO === 'true';

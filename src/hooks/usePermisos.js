import { useAuthStore } from '../store/useAuthStore';

/**
 * Deriva los permisos del perfil que devuelve la RPC `mi_perfil()`.
 *
 * Replica el patrón de `usePermissions.js` de NovTurnIA: los permisos salen de
 * `app_roles.permissions` en la base, nunca de comparar el nombre del rol en el
 * cliente. Agregar un rol nuevo es una fila en `app_roles`, sin desplegar nada.
 */
export function usePermisos() {
    const perfil = useAuthStore((s) => s.perfil);
    const p = perfil?.permissions ?? {};
    return {
        rol: perfil?.role_name ?? 'Invitado',
        descripcion: perfil?.role_description ?? '',
        verPanel: !!p.ver_panel,
        verBitacora: !!p.ver_bitacora,
        verUsuarios: !!p.ver_usuarios,
    };
}

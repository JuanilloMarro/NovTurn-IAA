# CLAUDE.md — Acceso Seguro

Instrucciones para el agente que implemente este proyecto.

## Qué es

Aplicación web que demuestra el proceso de acceso seguro para una práctica universitaria:
**Identificación → Autenticación con tres factores → Autorización por rol**.

No es un sistema completo. Se evalúa la implementación y la explicación del proceso de acceso,
no las funciones internas de la aplicación.

## Lee esto primero

**`PLAN.md` es la especificación completa.** Contiene el esquema SQL, la máquina de estados,
el orden de ejecución y el guion de la demostración. No improvises fuera de ese documento; si
algo del plan resulta incorrecto al contrastarlo con la realidad, decilo y proponé el cambio
antes de implementarlo.

## Stack

React 19 + Vite, Tailwind CSS (glass morphism), Zustand, Supabase (Auth + Postgres),
desplegado en Vercel.

`@supabase/supabase-js` debe ser **≥ 2.105.0** — las passkeys no existen antes.
El cliente se crea con `auth: { experimental: { passkey: true } }`.

## Reglas duras

1. **NovTurnIA es sólo lectura.** La carpeta `../NovTurnIA/NovTurnIA` está disponible como
   referencia y como origen de componentes para copiar. **Nunca escribas, edites ni borres
   nada ahí.** Es una aplicación en producción. `.claude/settings.json` lo bloquea, pero la
   regla vale igual.

2. **No toques el proyecto de Supabase de NovTurnIA** (`kwpaaqdkklwwfslhkqpb`). Este proyecto
   usa uno propio y distinto.

3. **Verificá, no asumas.** Antes de escribir código contra la API de passkeys, revisá los
   tipos del paquete instalado (`node_modules/@supabase/supabase-js/dist/module/...`) para
   confirmar la forma real de `auth.passkey.*` y `registerPasskey()`. La documentación marca
   esa API como experimental.

4. **Los permisos se derivan de la base, nunca del nombre del rol en el frontend.** Mismo
   criterio que `usePermissions.js` de NovTurnIA. Si hace falta un permiso nuevo, va como
   clave en `app_roles.permissions`, no como `if (rol === 'Administrador')`.

5. **El orden de los factores importa:** contraseña → biometría → TOTP. Verificar una passkey
   emite una sesión nueva en AAL1; si el TOTP fuera antes, la biometría lo anularía. Está
   explicado en `PLAN.md` §5.1. No lo reordenes sin entender esto.

6. **Toda ruta protegida comprueba sesión Y `aal === 'aal2'`.** Sin lo segundo, los factores
   dos y tres son decorativos.

7. **Cada paso del flujo se registra** con la RPC `registrar_evento`, tanto el éxito como el
   fallo. La bitácora es la evidencia de la demostración.

## Reutilización desde NovTurnIA

Copiar tal cual: `tailwind.config.js`, `src/index.css`, `src/components/ui/*`,
`src/components/Icons/AIStar.jsx`, `src/store/useToastStore.js`,
`src/components/ToastContainer.jsx`, `postcss.config.js`, `eslint.config.js`, `vercel.json`
(este último quitándole los dominios de Sentry de la CSP).

Tomar como referencia visual, no copiar tal cual: `src/pages/Login.jsx` (tarjeta glass, orbes,
`animate-fade-up`) y `src/hooks/usePermissions.js` (el patrón, no los ~45 permisos).

**No copies el `package.json` de NovTurnIA** — está en supabase-js 2.98.

## Sistema de diseño

Las clases están en `src/index.css`, copiado de NovTurnIA:
`.glass-premium` (blur fuerte, para modales), `.glass-morphism` (tarjetas),
`.glass-input` (campos), `.lg-orb` (burbujas decorativas).

Usá siempre los tokens de `tailwind.config.js` (paleta `navy`, tokens `glass`), nunca colores
crudos.

## Comandos

```bash
npm run dev      # servidor de desarrollo
npm run build    # compilar para producción
npm run preview  # previsualizar la compilación
```

No hay suite de pruebas. La verificación es manual siguiendo el guion de `PLAN.md` §10.

## Contexto de seguridad que hay que preservar

La RPC `identificar_usuario` permite **enumeración de usuarios** a propósito: la práctica lo
exige. Va detrás de `VITE_MODO_DEMO`. No la habilites por defecto ni quites la advertencia del
código: forma parte de lo que se explica en la exposición.

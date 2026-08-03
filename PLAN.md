# Plan de implementación — Acceso Seguro

Aplicación web que demuestra **Identificación → Autenticación (3 factores) → Autorización**.

Proyecto independiente de NovTurnIA. Reutiliza su sistema de diseño y sus componentes de UI,
pero tiene su propio repositorio, su propio proyecto de Supabase y su propio despliegue.

---

## 0. Decisión de stack: Supabase + React (no Django)

Se evaluaron las dos opciones. Gana Supabase + React por un margen amplio, y la razón
principal no es técnica sino de alcance.

| Criterio | Supabase + React (Vite) | Django |
|---|---|---|
| Reutilizar el frontend de NovTurnIA | **Total.** Mismo stack: React 19 + Vite + Tailwind. Se copian `index.css`, `tailwind.config.js`, `components/ui/` y el `Login.jsx` tal cual | **Cero.** Las plantillas de Django no son React. Para reutilizar habría que montar Django REST + un frontend React aparte: dos despliegues, dos repos y configuración de CORS |
| Algo que sé (contraseña) | Nativo | Nativo |
| Algo que tengo (TOTP) | Nativo y gratis (`auth.mfa.*`), verificado en plan free | `django-otp`, maduro y gratis |
| Algo que soy (WebAuthn) | Nativo (`auth.passkey.*`), experimental | `py_webauthn`, hay que escribir la ceremonia completa |
| Roles | Tablas propias + RLS | `Group`/`Permission` integrados + admin gratis. **Ventaja de Django** |
| Despliegue en Vercel | `git push` y listo. HTTPS automático | Runtime serverless de Python: arranques en frío, sin sistema de archivos persistente, estáticos con WhiteNoise, migraciones a mano contra una base remota. Funciona, pero es medio día de fricción ajena a la práctica |
| HTTPS para biometría en el teléfono | Inmediato | Inmediato una vez desplegado |
| Código propio que explicar al profesor | Menos: la verificación vive en el servidor de Supabase | Más: escribís la verificación WebAuthn vos mismo |

**Django gana en dos casillas**: roles integrados y cantidad de código propio para explicar.
Ninguna compensa tener que reconstruir toda la interfaz desde cero, que es exactamente lo que
se quería evitar.

La casilla "código propio que explicar" se compensa: la **orquestación** de los tres factores
—la máquina de estados, el control de que sea el mismo usuario en los tres pasos, el registro
de auditoría y la puerta de autorización— se escribe en este proyecto y es material más que
suficiente para la exposición. Supabase aporta la criptografía; el proceso de acceso lo
diseñás vos.

**Veredicto: Supabase + React + Vercel.**

---

## 1. Verificaciones ya hechas (no hay que repetirlas)

Contra la organización real de Supabase (`jmarroquin1106@gmail.com's Org`, plan **free**) y
contra el proyecto NovTurnIA (`kwpaaqdkklwwfslhkqpb`):

- **MFA TOTP es gratis.** La documentación oficial de Supabase lo dice textualmente: la API
  de TOTP es gratuita y está habilitada por defecto en todos los proyectos. Lo que cuesta
  $75/mes y exige plan Pro es únicamente **MFA por teléfono** (SMS/WhatsApp), que no vamos a usar.
- Existen `auth.mfa_factors`, `auth.mfa_challenges`, `auth.mfa_amr_claims`.
- El enum `auth.factor_type` contiene `totp`, `webauthn`, `phone`.
- Existen `auth.webauthn_credentials` y `auth.webauthn_challenges`.
- El endpoint público `/auth/v1/settings` de un proyecto free responde `"passkeys_enabled": false`
  → la bandera existe en el plan free, sólo está apagada.

- **CONFIRMADO en la implementación:** el interruptor de passkeys **sí está disponible en plan
  free**. Se activó sin fricción y `/auth/v1/settings` pasó a responder `"passkeys_enabled": true`.
  El **Plan B** de la sección 11 quedó sin usar. Se conserva documentado por si otro proyecto
  se topa con una restricción distinta.

> **Cómo comprobarlo sin entrar al panel.** El endpoint es público:
>
> ```bash
> curl -s "https://<ref>.supabase.co/auth/v1/settings" -H "apikey: <publishable-key>"
> ```
>
> Interesan `passkeys_enabled` y `mailer_autoconfirm` (este último en `true` significa que
> *Confirm email* está desactivado, que es lo que hace falta para registrar passkeys).

---

## 2. Configuración inicial

### 2.1 Carpetas y acceso al código de NovTurnIA

```
C:\Users\jmarr\Documents\Antigravity Projects\
├── NovTurnIA\NovTurnIA\      ← producción. SÓLO LECTURA para este proyecto
└── AccesoSeguro\             ← este proyecto. Todo lo nuevo se escribe acá
```

Ya está creado `AccesoSeguro\.claude\settings.json`, que le da a la IA lectura del código de
NovTurnIA y le **prohíbe escribir** ahí. Con eso puede consultar cualquier componente de
NovTurnIA como referencia sin riesgo de modificar producción.

Para trabajar, abrí la terminal en `AccesoSeguro` y lanzá el agente desde ahí. El directorio
de trabajo será `AccesoSeguro`; NovTurnIA queda como directorio adicional de lectura.

### 2.2 Crear el proyecto de Supabase

1. Panel de Supabase → **New project** en la organización existente.
   - Nombre: `acceso-seguro`
   - Región: `us-west-2` (la misma que NovTurnIA, menor latencia desde Guatemala)
   - Guardar la contraseña de la base de datos.
   - El plan free permite dos proyectos activos. Hoy hay uno activo (NovTurnIA) y uno pausado
     (Gama Webs News); los pausados no cuentan. Hay espacio.

2. **Authentication → Passkeys** → activar **Enable Passkey authentication**.
   - *Si el interruptor aparece bloqueado por plan, parar acá e ir al Plan B (sección 11).*
   - Relying Party Display Name: `Acceso Seguro`
   - Relying Party ID: **`localhost`** (por ahora — se cambia antes de la demo, ver Paso 9.3)
   - Relying Party Origins: `http://localhost:5173`

3. **Authentication → Providers → Email**: desactivar **Confirm email**.
   Motivo: Supabase exige que el usuario esté confirmado para registrar una passkey. Sin esto,
   los usuarios sembrados no van a poder registrar la huella.

4. **Authentication → MFA**: confirmar que **App Authenticator (TOTP)** esté habilitado
   (viene así por defecto). No tocar la sección Phone.

5. Copiar de **Project Settings → API**:
   - Project URL
   - Publishable key (`sb_publishable_...`)

### 2.3 Crear los usuarios de prueba

Hacerlo desde **Authentication → Users → Add user** (marcar *Auto Confirm User*). Tres usuarios:

| Correo | Contraseña | Rol previsto |
|---|---|---|
| `admin@gmail.com` | (la que se fije al crearlo) | Administrador |
| `santi@gmail.com` | idem | Usuario |
| `marro@gmail.com` | idem | Usuario |
| `diana@gmail.com` | idem | Usuario (desactivado, para la demo del punto 6) |

Los correos son los que se usaron realmente; el dominio da igual mientras *Confirm email* esté
desactivado. **Hace falta al menos un usuario desactivado** para poder demostrar ese camino, y
**al menos dos con biometría registrada** para demostrar el rechazo del punto 6.

> **No sembrar usuarios por SQL directo.** Si por alguna razón hubiera que hacerlo, todas las
> columnas de token de `auth.users` (`confirmation_token`, `recovery_token`, `email_change`,
> `email_change_token_new`, `email_change_token_current`, `phone_change`, `phone_change_token`,
> `reauthentication_token`) deben ir en `''` y nunca en `NULL`: GoTrue las lee como `string` de
> Go y con `NULL` el login devuelve 500 "Database error querying schema" aunque el hash de la
> contraseña sea correcto. Usar el panel evita el problema por completo.

Anotar los UUID de los tres usuarios; hacen falta en el paso 3.

---

## 3. Esquema de base de datos

Ejecutar en el **SQL Editor** del proyecto nuevo, en este orden.

### 3.1 Tablas

```sql
-- Roles del sistema. Los permisos viven en la base, nunca en el frontend.
create table public.app_roles (
    id          serial primary key,
    name        text not null unique,
    description text,
    permissions jsonb not null default '{}'::jsonb
);

-- Perfil de aplicación, enlazado 1:1 con auth.users
create table public.app_users (
    id         uuid primary key references auth.users(id) on delete cascade,
    email      text not null unique,
    full_name  text not null,
    role_id    integer not null references public.app_roles(id),
    active     boolean not null default true,
    created_at timestamptz not null default now()
);

-- Bitácora de acceso: cada paso del proceso queda registrado.
-- Es la evidencia visual de la práctica y el contenido del panel de Administrador.
create table public.access_log (
    id         bigserial primary key,
    email      text,
    user_id    uuid,
    step       text not null,      -- identificacion | password | biometria | totp | autorizacion | logout
    outcome    text not null,      -- exito | fallo
    detail     text,
    ip_hint    text,
    created_at timestamptz not null default now()
);

create index on public.access_log (created_at desc);
```

### 3.2 Datos semilla

```sql
insert into public.app_roles (name, description, permissions) values
  ('Administrador', 'Acceso total: puede ver la bitácora de accesos y el listado de usuarios',
   '{"ver_bitacora": true, "ver_usuarios": true, "ver_panel": true}'::jsonb),
  ('Usuario', 'Acceso básico: sólo su propio panel',
   '{"ver_bitacora": false, "ver_usuarios": false, "ver_panel": true}'::jsonb);

-- Sustituir los UUID por los reales del paso 2.3
insert into public.app_users (id, email, full_name, role_id, active) values
  ('<UUID-ADMIN>',    'admin@gmail.com', 'Administrador del Sistema', 1, true),
  ('<UUID-USUARIO>',  'santi@gmail.com', 'Santi',                     2, true),
  ('<UUID-INACTIVO>', 'diana@gmail.com', 'Diana',                     2, false);
```

### 3.3 RLS

> **CORREGIDO.** La primera versión de este plan ponía el `exists (select … from
> public.app_users …)` directamente dentro de la política **de** `public.app_users`. Postgres
> vuelve a aplicar la RLS a esa subconsulta y corta con
> `42P17: infinite recursion detected in policy for relation "app_users"`. La tabla quedaba
> ilegible para todo el mundo. La función auxiliar es `security definer`, así que su consulta
> interna no vuelve a pasar por la RLS y la recursión desaparece.

```sql
alter table public.app_roles  enable row level security;
alter table public.app_users  enable row level security;
alter table public.access_log enable row level security;

-- Resuelve un permiso del rol del usuario actual SIN disparar la RLS de nuevo.
-- Es la pieza que evita la recursión, y mantiene el criterio de que el permiso
-- se deriva de la base y nunca del nombre del rol en el frontend.
create or replace function public.tiene_permiso(p_clave text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select coalesce((r.permissions->>p_clave)::boolean, false)
    from public.app_users u
    join public.app_roles r on r.id = u.role_id
    where u.id = auth.uid();
$$;

revoke all on function public.tiene_permiso(text) from public;
grant execute on function public.tiene_permiso(text) to authenticated;

-- Cualquier usuario autenticado puede leer el catálogo de roles
create policy "roles legibles por autenticados"
  on public.app_roles for select to authenticated using (true);

-- Cada quien ve su propio perfil; quien tenga `ver_usuarios` los ve todos
create policy "perfil propio"
  on public.app_users for select to authenticated
  using (id = auth.uid() or public.tiene_permiso('ver_usuarios'));

-- La bitácora sólo la lee quien tenga el permiso
create policy "bitacora para administradores"
  on public.access_log for select to authenticated
  using (public.tiene_permiso('ver_bitacora'));
```

Nadie escribe en `access_log` directamente: se hace por RPC (3.5).

**Cómo verificar que no recursiona**, sin necesidad de usuarios reales:

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select count(*) from public.app_users;   -- debe devolver 0, no un error 42P17
```

Ese mismo ensayo demuestra el punto extra de la sección 10: un autenticado sin permiso
obtiene **cero filas** de `access_log`, porque la autorización la aplica la base.

### 3.4 RPC de identificación

Este es el paso 1 de la práctica. Es intencionalmente enumerable —ver la advertencia— y por eso
va detrás de una bandera.

```sql
create or replace function public.identificar_usuario(p_email text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user public.app_users%rowtype;
begin
    select * into v_user
    from public.app_users
    where lower(email) = lower(trim(p_email));

    if not found then
        insert into public.access_log (email, step, outcome, detail)
        values (p_email, 'identificacion', 'fallo', 'El identificador no existe en el sistema');
        return json_build_object('existe', false);
    end if;

    if not v_user.active then
        insert into public.access_log (email, user_id, step, outcome, detail)
        values (p_email, v_user.id, 'identificacion', 'fallo', 'Usuario desactivado');
        return json_build_object('existe', true, 'activo', false,
                                 'nombre', v_user.full_name);
    end if;

    insert into public.access_log (email, user_id, step, outcome, detail)
    values (p_email, v_user.id, 'identificacion', 'exito', 'Identificador reconocido');

    return json_build_object('existe', true, 'activo', true,
                             'nombre', v_user.full_name);
end;
$$;

revoke all on function public.identificar_usuario(text) from public;
grant execute on function public.identificar_usuario(text) to anon, authenticated;
```

> **Advertencia de seguridad que hay que explicar en la exposición.**
> Esta función confirma a cualquiera que un correo existe: es *enumeración de usuarios*.
> La práctica lo pide explícitamente ("el sistema deberá validar que el usuario exista" y
> "intento con un usuario inexistente"), pero un sistema en producción **no debe hacerlo**,
> porque le entrega a un atacante la lista de correos válidos y reduce el ataque a adivinar
> sólo la contraseña. Por eso en el frontend va detrás de `VITE_MODO_DEMO`, y en la exposición
> se menciona como decisión consciente. Eso convierte una vulnerabilidad en un punto a favor.

### 3.5 RPC de bitácora

```sql
create or replace function public.registrar_evento(
    p_email text, p_step text, p_outcome text, p_detail text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.access_log (email, user_id, step, outcome, detail)
    values (p_email, auth.uid(), p_step, p_outcome, p_detail);
end;
$$;

revoke all on function public.registrar_evento(text,text,text,text) from public;
grant execute on function public.registrar_evento(text,text,text,text) to anon, authenticated;
```

### 3.6 RPC de perfil + rol

```sql
create or replace function public.mi_perfil()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare v_row record;
begin
    select u.id, u.email, u.full_name, u.active,
           r.name as role_name, r.description as role_description, r.permissions
    into v_row
    from public.app_users u
    join public.app_roles r on r.id = u.role_id
    where u.id = auth.uid();

    if not found then return null; end if;
    return row_to_json(v_row);
end;
$$;

revoke all on function public.mi_perfil() from public;
grant execute on function public.mi_perfil() to authenticated;
```

> **CORREGIDO.** La primera versión omitía el `revoke ... from public`, a diferencia de las
> otras dos funciones. Postgres concede `execute` a `public` por defecto, así que `mi_perfil()`
> quedaba invocable por `anon`. Devuelve `null` sin sesión, pero el linter de Supabase lo marca
> y no hay razón para dejarlo abierto.

### 3.7 Perfil automático al crear el usuario

Sin esto, dar de alta a alguien es un proceso doble: crearlo en **Authentication → Users** y
después insertar su fila en `app_users` a mano. Con el disparador, basta lo primero.

```sql
create or replace function public.crear_perfil_al_registrarse()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_rol integer;
    v_nombre text;
begin
    select id into v_rol from public.app_roles where name = 'Usuario';
    if v_rol is null then
        raise warning 'No existe el rol Usuario; no se creó perfil para %', new.email;
        return new;
    end if;

    v_nombre := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');
    if v_nombre is null then
        v_nombre := initcap(split_part(new.email, '@', 1));
    end if;

    insert into public.app_users (id, email, full_name, role_id, active)
    values (new.id, new.email, v_nombre, v_rol, true)
    on conflict (id) do nothing;

    return new;
end;
$$;

drop trigger if exists crear_perfil_al_registrarse on auth.users;
create trigger crear_perfil_al_registrarse
    after insert on auth.users
    for each row execute function public.crear_perfil_al_registrarse();
```

El rol por defecto es `Usuario`. Conceder `Administrador` queda como un `update` deliberado:
no es algo que deba pasar solo.

**Probarlo sin ensuciar la base** — el bloque revierte siempre:

```sql
do $$
declare v_id uuid := gen_random_uuid(); v_perfil record;
begin
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                            email_confirmed_at, created_at, updated_at,
                            confirmation_token, recovery_token, email_change,
                            email_change_token_new, email_change_token_current,
                            reauthentication_token)
    values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
            'prueba@example.com', 'x', now(), now(), now(), '', '', '', '', '', '');

    select u.full_name, r.name as rol into v_perfil
      from public.app_users u join public.app_roles r on r.id = u.role_id
     where u.id = v_id;

    raise exception 'PRUEBA OK (revirtiendo) -> nombre=% rol=%', v_perfil.full_name, v_perfil.rol;
end $$;
```

Nótese que las columnas de token van en `''` y no en `NULL`, por el motivo del paso 2.3.

---

## 4. Andamiaje del proyecto frontend

> **Cuidado con `npm create vite@latest .`** sobre una carpeta que ya tiene archivos: ofrece
> vaciar el directorio actual, y ahí viven `PLAN.md` y `CLAUDE.md`. Si la carpeta no está
> vacía, es más seguro escribir a mano `package.json`, `vite.config.js` e `index.html`, que es
> lo que se hizo acá.

```bash
cd "C:/Users/jmarr/Documents/Antigravity Projects/AccesoSeguro"
npm create vite@latest . -- --template react
npm install
npm install @supabase/supabase-js@^2.105.0 react-router-dom lucide-react zustand
npm install -D tailwindcss@^3.4.0 postcss autoprefixer
npx tailwindcss init -p
```

> `@supabase/supabase-js` debe ser **≥ 2.105.0**. Las passkeys no existen en versiones
> anteriores. NovTurnIA está en 2.98 — por eso no se copia su `package.json`.

### 4.1 Qué se copia de NovTurnIA (sin modificar)

| Origen (`NovTurnIA/`) | Destino (`AccesoSeguro/`) | Nota |
|---|---|---|
| `tailwind.config.js` | `tailwind.config.js` | Paleta `navy` + tokens `glass`. Idéntico |
| `src/index.css` | `src/index.css` | 711 líneas: `.glass-premium`, `.glass-morphism`, `.glass-input`, `.lg-orb`, animaciones. **La pieza de mayor valor** |
| `src/components/ui/Button.jsx` | igual | |
| `src/components/ui/Badge.jsx` | igual | Para la etiqueta del rol |
| `src/components/ui/Modal.jsx` | igual | Para el QR del TOTP |
| `src/components/ui/Skeleton.jsx` | igual | |
| `src/components/ui/Tooltip.jsx` | igual | |
| `src/components/Icons/AIStar.jsx` | igual | Adorno del encabezado |
| `src/store/useToastStore.js` | igual | |
| `src/components/ToastContainer.jsx` | igual | Avisos de error de cada factor |
| `postcss.config.js`, `eslint.config.js` | igual | |
| `vercel.json` | `vercel.json` | **Editar**: quitar los dominios de Sentry del `connect-src` de la CSP. Dejar `https://*.supabase.co` |

Al copiar los componentes de `ui/`, revisar los `import` que apunten a rutas que no existan en
el proyecto nuevo y ajustarlos. Son archivos chicos y autocontenidos.

### 4.2 Qué se copia como referencia (no tal cual)

- `src/pages/Login.jsx` — la tarjeta glass, los orbes ambientales, el robot flotante y la
  animación `animate-fade-up`. Se toma la **estructura visual** y se le cambia el contenido
  por la máquina de estados de 5 pasos.
- `src/hooks/usePermissions.js` — el patrón de derivar permisos desde la base y nunca
  codificarlos en el cliente. Se replica con muchos menos permisos.

### 4.3 Archivos nuevos

```
src/
├── config/supabase.js            Cliente con experimental.passkey activado
├── store/useAuthStore.js         Estado del flujo: paso actual, email, perfil
├── hooks/
│   ├── useFlujoAcceso.js         LA MÁQUINA DE ESTADOS (sección 5)
│   └── usePermisos.js            Deriva permisos del rol
├── components/acceso/
│   ├── PasoIdentificacion.jsx
│   ├── PasoContrasena.jsx
│   ├── PasoBiometria.jsx
│   ├── PasoTotp.jsx
│   ├── IndicadorProgreso.jsx     Las 4 pastillas del proceso
│   └── TarjetaAcceso.jsx         Envoltorio glass compartido
├── pages/
│   ├── Acceso.jsx                Orquesta los 4 pasos
│   ├── Panel.jsx                 "Acceso autorizado — Rol: X"
│   ├── Bitacora.jsx              Sólo Administrador
│   └── Enrolamiento.jsx          Registrar TOTP y passkey
└── App.jsx                       Rutas + guardas
```

---

## 5. La máquina de estados de autenticación

Es el corazón del proyecto y lo que se explica en la exposición.

### 5.1 El orden y por qué

```
1. IDENTIFICACIÓN   correo               → ¿existe? ¿está activo?
2. CONTRASEÑA       algo que SÉ          → signInWithPassword       → sesión AAL1
3. BIOMETRÍA        algo que SOY         → passkey (WebAuthn)       → sesión nueva AAL1
4. TOTP             algo que TENGO       → mfa.challenge + verify   → sesión AAL2
5. AUTORIZACIÓN     rol y permisos       → mi_perfil()
```

**Por qué la biometría va antes que el TOTP y no al revés.** En Supabase, verificar una passkey
**emite una sesión nueva** que reemplaza la anterior. Si el TOTP fuera antes, la sesión ya
estaría en AAL2 y la passkey la devolvería a AAL1: la aplicación creería que falta el segundo
factor y mandaría al usuario de vuelta al TOTP. Poniendo el TOTP al final, el nivel AAL2 queda
reflejado en el token que se usa de ahí en adelante.

Esto no es un rodeo: es una decisión de diseño con fundamento, y explicarla en la exposición
demuestra que se entendió cómo funciona el nivel de garantía del autenticador (AAL). El orden
de la práctica (sé → tengo → soy) es un ejemplo, no una imposición: lo que exige es que se
superen los tres.

### 5.2 Paso 1 — Identificación

```js
const { data } = await supabase.rpc('identificar_usuario', { p_email: email });

if (!data.existe)  → error: "No existe una cuenta con ese identificador."
if (!data.activo)  → error: "La cuenta existe pero está desactivada."
else               → guardar email y nombre, avanzar a CONTRASEÑA
```

La pantalla saluda con el nombre: *"Hola, Juan Marroquín"*. Hace visible que la identificación
ocurrió y es distinta de la autenticación — que es justo lo que la práctica evalúa.

Envolver la llamada en `if (import.meta.env.VITE_MODO_DEMO === 'true')`. Con la bandera apagada
se salta directo a la contraseña y el mensaje de error es genérico, como debe ser en producción.

### 5.3 Paso 2 — Contraseña (algo que sé)

```js
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
if (error) {
  await supabase.rpc('registrar_evento', {
    p_email: email, p_step: 'password', p_outcome: 'fallo', p_detail: error.message
  });
  → error: "Contraseña incorrecta." y quedarse en el paso 2
}
const idEsperado = data.user.id;   // ← GUARDAR. Se compara en el paso 3
await supabase.rpc('registrar_evento', {
  p_email: email, p_step: 'password', p_outcome: 'exito', p_detail: 'Factor conocimiento superado'
});
→ avanzar a BIOMETRÍA
```

`idEsperado` va en el estado del store, no en una variable local: el paso 3 lo necesita.

### 5.4 Paso 3 — Biometría (algo que soy)

Se usa la **API de dos pasos**, no el atajo `signInWithPasskey()`.

> **ÉSTA ES LA RAZÓN REAL, y no la que decía la primera versión del plan.**
> `@supabase/auth-js` (verificado en 2.111.0, `lib/webauthn.js`) impone estas constantes a
> las dos funciones de alto nivel:
>
> ```js
> export const DEFAULT_CREATION_OPTIONS = {
>     hints: ['security-key'],
>     authenticatorSelection: {
>         authenticatorAttachment: 'cross-platform',
>         residentKey: 'discouraged',
>         userVerification: 'preferred',
>         /** set to preferred because older yubikeys don't have PIN/Biometric */
>     },
> ```
>
> `cross-platform` le pide al navegador que **excluya** el autenticador integrado del
> dispositivo. En iOS el resultado es que Safari sólo ofrece *"escanear código"* y *"usar llave
> de seguridad"*, **nunca Face ID**. La librería está afinada para YubiKeys — lo dice su propio
> comentario. Para una práctica sobre los tres factores eso es lo contrario de lo que se busca:
> un QR o una llave USB son "algo que TENGO", y duplican el factor que ya cubre el TOTP.
>
> Ni `registerPasskey()` ni `signInWithPasskey()` aceptan sobrescribir esas opciones. La API de
> dos pasos es el único punto donde se pueden imponer. **Ésa es la razón para usarla.**

Las opciones que hay que forzar:

```js
// Al REGISTRAR
authenticatorSelection: {
    authenticatorAttachment: 'platform',   // sólo el autenticador integrado
    residentKey: 'required',               // descubrible: login sin escribir usuario
    requireResidentKey: true,
    userVerification: 'required',          // obliga a comprobar QUIÉN, no sólo presencia
},
hints: ['client-device'],

// Al AUTENTICAR (en `get()` no existe authenticatorAttachment)
userVerification: 'required',
hints: ['client-device'],
```

`userVerification: 'required'` importa tanto como el `platform`: con `'preferred'` un
autenticador puede limitarse a detectar que hay alguien presente sin comprobar quién es, y ahí
el factor de inherencia se cae solo.

**Los ayudantes de serialización de auth-js no se reexportan** desde `@supabase/supabase-js`,
así que la conversión base64url ↔ binario hay que resolverla aparte. Lo más limpio es usar la
API nativa de WebAuthn nivel 3 —`PublicKeyCredential.parseCreationOptionsFromJSON()` y
`credential.toJSON()`, disponibles en Safari 17.4+ y Chrome 119+— con un respaldo manual.
Está implementado en `src/config/webauthn.js`.

```js
const { data: opciones, error: e1 } = await supabase.auth.passkey.startAuthentication();
if (e1) → error

// Esto abre Face ID / Touch ID / Windows Hello
const { data: sesion, error: e2 } = await supabase.auth.passkey.verifyAuthentication({
  challengeId: opciones.challenge_id,
  credential:  await ejecutarCeremonia(opciones.options)   // con los overrides de arriba
});
if (e2) → "No se pudo verificar la biometría."

// CONTROL CRÍTICO
if (sesion.user.id !== idEsperado) {
  await supabase.auth.signOut();
  await supabase.rpc('registrar_evento', {
    p_email: email, p_step: 'biometria', p_outcome: 'fallo',
    p_detail: 'La huella pertenece a otra cuenta'
  });
  → error: "La biometría no corresponde al usuario identificado." y volver al paso 1
}
→ avanzar a TOTP
```

**Por qué ese control es obligatorio.** Las passkeys de Supabase son *credenciales
descubribles*: el autenticador muestra una lista de cuentas y el usuario elige. Sin la
comparación de identificadores, alguien podría pasar los pasos 1 y 2 como `admin@` y luego
poner la huella de `usuario@`, y quedar dentro. Con la comparación, ese intento se rechaza —
y encima **es la mejor forma de demostrar el punto 6 de la práctica** (intento de autenticación
incorrecto) en vivo.

**Verificar contra el `.d.ts` del paquete instalado antes de escribir el código**, no asumir.
Las formas confirmadas en 2.111.0:

| Llamada | Devuelve / recibe |
|---|---|
| `passkey.startRegistration()` | `{ challenge_id, options, expires_at }` |
| `passkey.verifyRegistration({ challengeId, credential })` | `{ id, friendly_name?, created_at }` |
| `passkey.startAuthentication()` | `{ challenge_id, options, expires_at }` |
| `passkey.verifyAuthentication({ challengeId, credential })` | `{ session, user }` |
| `passkey.list()` | **un arreglo directo**, no `{ passkeys: [...] }` |
| `passkey.delete({ passkeyId })` | el parámetro es `passkeyId`, no `id` |

### 5.5 Paso 4 — TOTP (algo que tengo)

```js
const { data: factores } = await supabase.auth.mfa.listFactors();
const totp = factores.totp[0];
if (!totp) → mandar a /enrolamiento

const { data: reto } = await supabase.auth.mfa.challenge({ factorId: totp.id });
const { error } = await supabase.auth.mfa.verify({
  factorId: totp.id, challengeId: reto.id, code: codigoIngresado
});
if (error) → "Código incorrecto o vencido." (registrar el fallo y permitir reintento)

const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
// aal.currentLevel debe ser 'aal2'
→ avanzar a AUTORIZACIÓN
```

Mostrar el nivel AAL en pantalla (`AAL1 → AAL2`). Es evidencia visible de que la autenticación
escaló de nivel, no sólo de que se apretaron botones.

### 5.6 Paso 5 — Autorización

```js
const { data: perfil } = await supabase.rpc('mi_perfil');
if (!perfil) { await supabase.auth.signOut(); → "Sin perfil asignado." }
await supabase.rpc('registrar_evento', {
  p_email: perfil.email, p_step: 'autorizacion', p_outcome: 'exito',
  p_detail: `Rol concedido: ${perfil.role_name}`
});
→ navegar a /panel
```

### 5.7 Guarda de sesión

Toda ruta protegida verifica **dos** cosas, no una:

```js
const { data: { session } } = await supabase.auth.getSession();
const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
if (!session || aal.currentLevel !== 'aal2') → redirigir a /acceso
```

Sin la comprobación de AAL, una sesión que sólo pasó la contraseña entraría al panel y los
otros dos factores serían decorativos.

---

## 6. Autorización y roles

`usePermisos.js`, replicando el patrón de NovTurnIA:

```js
export function usePermisos() {
    const { perfil } = useAuthStore();
    const p = perfil?.permissions ?? {};
    return {
        rol:          perfil?.role_name ?? 'Invitado',
        descripcion:  perfil?.role_description ?? '',
        verPanel:     !!p.ver_panel,
        verBitacora:  !!p.ver_bitacora,
        verUsuarios:  !!p.ver_usuarios,
    };
}
```

Los permisos **nunca** se codifican por nombre de rol en el frontend. Si mañana se agrega un
rol "Auditor", basta con una fila en `app_roles`, sin desplegar nada. Es un argumento fuerte
para la exposición.

**Diferencia visible entre roles** (la práctica no la exige, pero vale la pena):

- `/panel` — ambos roles. Muestra en grande **"Acceso autorizado — Rol: Administrador"** o
  **"— Rol: Usuario"**, más los tres factores superados con su marca de verificación y la hora.
- `/bitacora` — sólo Administrador. Tabla de `access_log`. Si `Usuario` intenta entrar por URL,
  la guarda redirige a `/panel` con el aviso "No tenés permiso para ver la bitácora".

Ese intento fallido por URL directa es la mejor demostración del punto 9.

---

## 7. Pantalla de enrolamiento

Sin esto no hay nada que verificar después. Ruta `/enrolamiento`.

> **REESCRITA.** La primera versión decía "accesible con sesión AAL1" y ponía el TOTP antes que
> la passkey. Las dos cosas resultaron equivocadas, y la segunda deja la cuenta trabada sin
> salida. Detalle abajo.

### 7.1 Va DETRÁS del proceso, no al lado

La pantalla no puede tener su propio formulario de correo y contraseña. Si lo tiene, es una
**segunda puerta al sistema**: permite dar de alta factores sin pasar por la identificación,
que es justamente la etapa que la práctica evalúa.

- `/enrolamiento` exige una sesión existente. Sin ella, redirige al inicio del proceso.
- Se llega desde el **paso 2 (contraseña)**, que redirige solo cuando a la cuenta le falta
  algún factor.
- No lleva botón de "salir" a otro login.

### 7.2 El orden es BIOMETRÍA primero, TOTP después

En cuanto la cuenta tiene un factor TOTP verificado, Supabase responde:

```
AAL2 session is required to manage passkeys when MFA is enabled
```

Y la sesión de contraseña es AAL1. O sea: **quien enrola el TOTP primero ya no puede registrar
la biometría**, porque para elevar a AAL2 necesita el TOTP, y aunque lo tenga, la pantalla debe
saber pedírselo. Registrando la biometría primero, el problema no aparece nunca.

Es una regla sensata y vale la pena explicarla en la exposición: si bastara una sesión de sólo
contraseña para añadir un factor nuevo, a quien robara la contraseña le alcanzaría con
registrar su propia huella para saltarse el segundo factor para siempre.

Si aun así hay que gestionar passkeys con MFA ya activo, la pantalla debe **elevar la sesión**:
`mfa.challenge` + `mfa.verify` con el código, y después `refreshSession()` — el token nuevo
trae `aal2`, pero el cliente puede seguir enviando el anterior hasta que le toque renovarlo.

**Biometría:**
```js
const { data: reto } = await supabase.auth.passkey.startRegistration();
const credencial   = await crearCredencialBiometrica(reto.options);  // con overrides §5.4
await supabase.auth.passkey.verifyRegistration({
  challengeId: reto.challenge_id, credential: credencial,
});
// data.friendly_name viene del AAGUID: "iCloud Keychain", "Windows Hello"...
```

**TOTP:**
```js
const { data } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'Acceso Seguro' });
// data.totp.qr_code es un SVG. OJO: según la versión puede venir SIN el prefijo `data:`.
//   const src = qr.startsWith('data:') ? qr : `data:image/svg+xml;utf-8,${encodeURIComponent(qr)}`
// data.totp.secret es el texto por si el QR no se lee
// Luego: challenge + verify con el código para activarlo
```

### 7.3 Un solo TOTP por cuenta

`mfa.challenge` se emite **contra un factor concreto**. Con dos factores activos, si se reta
al que no está cargado en el teléfono el código no valida nunca, sin ningún mensaje que lo
explique. O se permite un único autenticador, o la interfaz deja elegir cuál se está usando.

### 7.4 Si se pierde el secreto TOTP

Con MFA enrolado y el secreto borrado del autenticador, la cuenta queda en punto muerto: no se
puede llegar a AAL2 y por tanto no se puede gestionar nada. La recuperación es del lado del
servidor:

```sql
delete from auth.mfa_challenges where factor_id = '<uuid>';
delete from auth.mfa_factors     where id = '<uuid>';
```

Sin factores MFA, registrar una passkey vuelve a bastar con sesión AAL1.

Enrolar al menos **dos usuarios** antes del ensayo: hace falta una segunda credencial para
demostrar en vivo el rechazo por biometría de otra cuenta (punto 6 del guion).

---

## 8. Variables de entorno

`.env.local` (no se sube al repositorio):

```
VITE_SUPABASE_URL=https://<ref-del-proyecto-nuevo>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_MODO_DEMO=true
```

`src/config/supabase.js`:

```js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    { auth: { experimental: { passkey: true } } }   // ← obligatorio para passkeys
);
```

Sin `experimental.passkey`, el espacio de nombres `supabase.auth.passkey` no existe.

---

## 9. Despliegue en Vercel

### 9.1 Repositorio

```bash
git init
git add -A
git commit -m "Acceso Seguro: identificacion, MFA de tres factores y autorizacion por rol"
gh repo create acceso-seguro --private --source=. --push
```

### 9.2 Vercel

1. Importar el repositorio. Framework: **Vite**. Build `npm run build`, salida `dist`.
2. Variables de entorno (las tres del paso 8), en Production y Preview.
3. Desplegar. Anotar el dominio, por ejemplo `acceso-seguro.vercel.app`.

### 9.3 Cambiar el Relying Party ID — PASO CRÍTICO, NO SALTAR

Una passkey queda amarrada criptográficamente al dominio donde se registró. Y **el RP ID y los
orígenes tienen que compartir dominio**: el origen debe ser el mismo host que el RP ID o un
subdominio suyo. `localhost` no es subdominio de `vercel.app`, así que **no se puede tener
las dos cosas configuradas a la vez**.

De ahí el plan en dos fases:

- **Fase A — desarrollo.** RP ID `localhost`, origen `http://localhost:5173`. Se programa y se
  prueba todo el flujo en la máquina.
- **Fase B — antes de la demo.** En Supabase → Authentication → Passkeys, cambiar a:
  - Relying Party ID: `acceso-seguro.vercel.app`
  - Relying Party Origins: `https://acceso-seguro.vercel.app`

> **Tres detalles que costaron tiempo y rompen esto en silencio.**
>
> 1. **Confirmar cuál es el dominio real antes de configurar nada.** El nombre del proyecto en
>    Vercel puede estar ocupado por otra persona: los subdominios de `vercel.app` son globales.
>    En este proyecto `acceso-seguro.vercel.app` respondía HTTP 200 pero servía una aplicación
>    ajena; la nuestra estaba en `nov-turn-iaa.vercel.app`. Se distingue comparando el hash del
>    bundle con el del build local:
>    ```bash
>    curl -s "https://<host>/" | grep -oE "index-[A-Za-z0-9_-]+\.js"
>    ```
> 2. **El RP ID va sin esquema y sin barra final**, y tiene que ser el **host completo**.
>    `vercel.app` a secas no sirve: está en la Public Suffix List y el navegador lo rechaza.
> 3. **El Origin no lleva barra final.** Un origin de WebAuthn es esquema + host + puerto, nunca
>    ruta. El navegador manda `https://host` y Supabase lo compara como texto literal: con
>    `https://host/` la comparación falla y la verificación se cae sin explicación útil.
>
> El **Relying Party Display Name** es el texto que aparece en el diálogo de Face ID o Windows
> Hello. Es lo que se ve proyectado en la exposición, así que conviene que diga el nombre de la
> aplicación aunque el dominio diga otra cosa.

  Al cambiarlo, **las passkeys registradas en localhost dejan de servir**. Hay que volver a
  registrarlas desde `/enrolamiento` en el dominio de Vercel, con el teléfono o con el equipo
  de la demo. El TOTP no se ve afectado.

  Hacer la Fase B **al menos un día antes** de la entrega y ensayar el flujo completo en el
  dominio final. Es el error que arruina demos: ensayar en localhost y descubrir en el salón
  que el navegador dice "no hay passkeys disponibles".

### 9.4 Biometría en el teléfono

Con HTTPS de Vercel, abrir `https://acceso-seguro.vercel.app` desde el celular:

- **Android/Chrome** → huella o rostro del dispositivo.
- **iPhone/Safari** → Face ID o Touch ID.

Recomendación fuerte: **hacer la demostración desde el teléfono**, proyectando la pantalla. Si
la laptop no tiene lector de huella ni cámara infrarroja, Windows Hello va a pedir un **PIN** —
la ceremonia WebAuthn se completa igual y el login funciona, pero lo que se ve proyectado es
alguien escribiendo un PIN, es decir "algo que sé" por segunda vez. El punto 5 queda flojo.
El teléfono siempre da biometría real.

Comprobar el equipo con antelación: `Configuración → Cuentas → Opciones de inicio de sesión`.
Si aparece "Huella digital" o "Reconocimiento facial" como disponible, la laptop sirve.

---

## 10. Guion de la demostración (los 10 puntos)

| # | Qué se pide | Qué hacer | Qué se ve |
|---|---|---|---|
| 1 | Identificación | Escribir `admin@gmail.com` → Continuar | Saluda con el nombre y avanza al paso 2 |
| 2 | Usuario inexistente | Volver, escribir `nadie@correo.com` | "No existe una cuenta con ese identificador." No avanza |
| 3 | Algo que sé | Contraseña correcta | Pastilla "Conocimiento" en verde. AAL1 |
| 4 | Algo que tengo | Código de Google Authenticator | Pastilla "Posesión" en verde. **AAL1 → AAL2** |
| 5 | Algo que soy | Huella en el teléfono | Pastilla "Inherencia" en verde |
| 6 | Intento incorrecto | Tres variantes, a elegir: contraseña mal; código TOTP vencido; **o la huella de otra cuenta** | Mensaje específico, no avanza, y el fallo queda en la bitácora |
| 7 | Autenticación exitosa | Completar los tres | Entra a `/panel` |
| 8 | Determinación del rol | Se muestra solo | "Rol: Administrador" con su descripción, leída de la base |
| 9 | Acceso según el rol | Cerrar sesión, entrar como `usuario@` e intentar `/bitacora` escribiendo la URL | Redirige a `/panel` con "No tenés permiso". Con `admin@`, la bitácora se ve completa |
| 10 | Cierre de sesión | Botón Cerrar sesión | Vuelve al paso 1, la sesión queda invalidada y el evento se registra |

**Remate para la exposición:** entrar como Administrador y abrir `/bitacora`. Ahí está toda la
demostración escrita sola: cada identificación, cada factor superado, cada fallo, con su hora.
Es la prueba de que el proceso ocurrió y no es una secuencia de pantallas.

**Punto extra si se quiere lucir:** mostrar que `access_log` está protegida por RLS. Con la
sesión de `usuario@` abierta, ejecutar la consulta en la consola del navegador — devuelve cero
filas. La autorización no es sólo la interfaz: la base misma la aplica.

---

## 11. Plan B — si el interruptor de passkeys no está en plan free

Se implementa WebAuthn a mano. Cumple la práctica igual y da **más** código propio que explicar.

1. Tabla `public.credenciales_webauthn (id, user_id, credential_id, public_key, counter, created_at)`.
2. Edge Function `webauthn` con `@simplewebauthn/server` y cuatro rutas:
   `registro/inicio`, `registro/fin`, `login/inicio`, `login/fin`.
3. En el navegador, `@simplewebauthn/browser`: `startRegistration()` y `startAuthentication()`.
4. El paso 3 del flujo llama a la función en lugar de a `supabase.auth.passkey.*`. **No emite
   sesión**, así que desaparece el problema del AAL y el orden puede ser el de la práctica
   (sé → tengo → soy).

Son unas 150 líneas más. Las Edge Functions están incluidas en el plan free.

**Cuándo usarlo:** sólo si el paso 2.2 falla. Comprobarlo antes de escribir cualquier código.

---

## 12. Orden de ejecución

> **REORDENADO.** El orden original hacía enrolar en `localhost` y desplegar al final. Como
> cambiar el RP ID invalida toda passkey ya registrada, ese trabajo se tira entero. Si no hay
> dominio propio y la demo va a correr sobre `*.vercel.app`, **desplegar primero y enrolar una
> sola vez, ya en el dominio final.**

1. Crear el proyecto de Supabase y **comprobar el interruptor de passkeys** (2.2).
   Confirmado disponible en plan free; si otro proyecto se topa con una restricción → sección 11.
2. Desactivar *Confirm email* (2.2.3) y crear los usuarios (2.3).
3. Ejecutar todo el SQL de la sección 3, incluido el disparador de 3.7, y verificar:
   `select * from app_users` y el ensayo anti-recursión de 3.3.
4. Andamiar el proyecto Vite e instalar dependencias (4).
5. Copiar los archivos de NovTurnIA (4.1). Comprobar que `npm run dev` levante con los estilos glass.
6. `config/supabase.js` + `.env.local` (8).
7. **Desplegar en Vercel** (9.1, 9.2) y **confirmar cuál es el dominio real** (9.3).
8. Configurar el RP ID con ese dominio (9.3).
9. Máquina de estados (5) y pantalla de enrolamiento (7), que va detrás del paso de contraseña.
10. Panel y bitácora (6).
11. Guardas de ruta (5.7).
12. Enrolar **biometría primero y TOTP después** (7.2) para al menos dos usuarios, desde el
    teléfono y sobre el dominio final. Verificar en la base: `select * from auth.mfa_factors`
    y `select * from auth.webauthn_credentials` deben tener filas.
13. Repasar que la interfaz no exponga el diseño interno (14).
14. Ensayar el guion completo (10) desde el teléfono, de principio a fin, dos veces.

---

## 13. Errores que van a aparecer y cómo se resuelven

| Síntoma | Causa | Solución |
|---|---|---|
| `supabase.auth.passkey is undefined` | Falta `experimental: { passkey: true }` o la versión es < 2.105 | Revisar `config/supabase.js` y `npm ls @supabase/supabase-js` |
| `passkey_disabled` | El interruptor está apagado en el panel | Paso 2.2 |
| El navegador dice "no hay passkeys disponibles" | El RP ID no coincide con el dominio actual | Paso 9.3. Es el error más frecuente |
| Windows Hello pide PIN en vez de huella | El equipo no tiene sensor biométrico | Demostrar desde el teléfono (9.4) |
| Registrar la passkey falla con el correo sin confirmar | Supabase exige usuario confirmado | Paso 2.2.3, o marcar *Auto Confirm* al crear el usuario |
| El TOTP dice "código inválido" con el código correcto | Desfase de reloj | El código vale 30s con una ventana de tolerancia. Sincronizar la hora del teléfono |
| Tras la passkey, la aplicación pide TOTP de nuevo | La sesión volvió a AAL1 | Es exactamente lo que evita el orden de 5.1. Revisar que la biometría vaya antes del TOTP |
| `mi_perfil()` devuelve null | Falta la fila en `app_users` o el UUID no coincide | Comparar `auth.users.id` con `app_users.id` |
| 500 "Database error querying schema" al iniciar sesión | Usuario sembrado por SQL con tokens en `NULL` | Ver la advertencia del paso 2.3 |
| `42P17: infinite recursion detected in policy for relation "app_users"` | La política consulta su propia tabla | Función auxiliar `security definer` (3.3) |
| En iOS sólo salen "escanear código" y "usar llave de seguridad", nunca Face ID | `auth-js` fuerza `authenticatorAttachment: 'cross-platform'` | Ceremonia de dos pasos con `'platform'` (5.4) |
| `AAL2 session is required to manage passkeys when MFA is enabled` | La cuenta ya tiene TOTP y la sesión es AAL1 | Enrolar biometría antes que TOTP (7.2); si ya pasó, elevar con `mfa.verify` + `refreshSession()` |
| Se eleva a AAL2 pero el servidor sigue rechazando | El cliente sigue enviando el token anterior | `refreshSession()` después de `mfa.verify()` (7.2) |
| El TOTP no valida nunca aunque el código sea correcto | Hay dos factores y se reta al que no está en el teléfono | Un solo autenticador, o dejar elegir cuál (7.3) |
| Se perdió el secreto TOTP y no se puede hacer nada | Punto muerto: sin AAL2 no se gestiona nada | Borrar el factor desde el servidor (7.4) |
| El QR del TOTP sale roto | `qr_code` llegó sin el prefijo `data:` | Anteponerlo si falta (7.2) |
| En iPhone el contenido se mete bajo el notch | Falta `viewport-fit=cover` en el meta viewport | Sin él, `env(safe-area-inset-*)` siempre vale 0 |
| En pantallas bajas no se llega al borde superior de la tarjeta | Centrado con `items-center` recorta el desbordamiento | Centrar con márgenes automáticos (`my-auto`) |
| El despliegue "funciona" pero es otra aplicación | El subdominio de `vercel.app` estaba ocupado | Comparar el hash del bundle con el del build local (9.3) |

---

## 14. Interfaz: qué no debe decir

La interfaz no explica cómo está construido el sistema. Suena obvio y se cuela con facilidad,
porque mientras se desarrolla ese texto es útil.

Fuera de la pantalla:

- Nombres de tablas, columnas, políticas o permisos (`app_roles.permissions`, `access_log`,
  `ver_bitacora`). Le regalan a un atacante el mapa del modelo de datos.
- Avisos del tipo "modo demostración: el sistema confirma si el identificador existe".
- Explicar los controles de seguridad: *"si la huella pertenece a otra cuenta el acceso se
  deniega y queda registrado"* le dice a alguien exactamente qué se comprueba y qué no.
- Referencias a este documento.
- Jerga interna como AAL1/AAL2 en pantallas de uso normal.

Dentro: etiquetas de producto (*Identificación*, *Biometría*, *Autenticador*) y mensajes de
error que digan qué hacer, no por qué falló por dentro.

Lo que sí conviene conservar es el **indicador de progreso** con los cuatro pasos: hace visible
que identificación y autenticación son etapas distintas, que es lo que la práctica evalúa, sin
revelar nada de la implementación.

---

## 15. Reutilizar esto en otra aplicación

Lo específico de la práctica es la enumeración de usuarios (3.4) y el guion (10). Todo lo demás
sirve tal cual para cualquier aplicación que necesite acceso con varios factores y roles.

### 15.1 Qué se lleva sin cambios

| Pieza | Archivo | Nota |
|---|---|---|
| Ceremonia WebAuthn de plataforma | `src/config/webauthn.js` | Independiente del proyecto. Es la pieza de más valor: resuelve el problema de `cross-platform` |
| Función `tiene_permiso()` + políticas | SQL de 3.3 | Cambian las claves de permiso, no la forma |
| Disparador de perfil automático | SQL de 3.7 | Cambia el rol por defecto |
| Bitácora + RPC `registrar_evento` | 3.1, 3.5 | Cambian los valores de `step` |
| Guarda de sesión con AAL | `App.jsx` | Sesión **y** `aal2`; recupera el perfil tras recargar |
| `usePermisos` | `src/hooks/usePermisos.js` | Cambian las claves |

### 15.2 Decisiones que conviene repetir

1. **Los permisos viven en la base**, en una columna `jsonb` del rol. Nunca `if (rol === 'Admin')`.
   Agregar un rol es una fila, no un despliegue.
2. **Toda ruta protegida comprueba sesión Y nivel AAL.** Sin lo segundo, los factores extra son
   decorativos: una sesión de sólo contraseña entraría igual.
3. **Cada paso se registra, el éxito y el fallo.** Es lo que permite explicar qué pasó cuando algo
   sale mal, y en la exposición es la evidencia de que el proceso ocurrió.
4. **El registro de factores va detrás de la autenticación**, nunca como pantalla suelta con su
   propio login.
5. **Biometría antes que TOTP** al enrolar, por la regla de AAL2.
6. **Verificar la API contra el `.d.ts` del paquete instalado** antes de escribir el código. En
   este proyecto las tres suposiciones que no se verificaron —la política RLS, el AAL del
   enrolamiento y las opciones del autenticador— fueron las tres que costaron tiempo.

### 15.3 Si la aplicación es real y no una práctica

- **Quitar `identificar_usuario`.** Confirmar si un correo existe es enumeración de usuarios. En
  producción el error se da al final y es genérico: *"credenciales incorrectas"*.
- **Reforzar la RLS de escritura.** Este plan sólo define políticas de `select`, porque nada se
  escribe desde el cliente. En cuanto haya escrituras hacen falta políticas de `insert`,
  `update` y `delete`.
- **Considerar exigir `aal2` como política restrictiva** en las tablas sensibles, no sólo en la
  guarda del frontend:
  ```sql
  create policy "sólo con MFA" on <tabla>
    as restrictive to authenticated
    using ((select auth.jwt()->>'aal') = 'aal2');
  ```
- **Poner un límite de intentos.** No hay nada en este plan que frene la fuerza bruta sobre la
  contraseña.
- **Fijar el RP ID a un dominio propio** desde el principio. Cambiarlo invalida todas las
  passkeys registradas.

### 15.4 Móvil, desde el primer día

Las passkeys se demuestran en el teléfono, así que la interfaz nace móvil:

- `viewport-fit=cover` en el meta viewport, **o `env(safe-area-inset-*)` siempre devuelve 0** y
  el contenido se mete bajo el notch.
- `100dvh` y no `100vh`: sigue la altura real cuando la barra de direcciones se contrae.
- Centrar con **márgenes automáticos**, no con `items-center`. Con centrado por alineación, un
  contenido más alto que la pantalla se recorta por arriba y esa parte queda inalcanzable.
- Comprobarlo en una pantalla deliberadamente baja (unos 380 px de alto), que es donde aparece.

---

## 16. Lo que NO se hace

- No se toca el proyecto de Supabase de NovTurnIA (`kwpaaqdkklwwfslhkqpb`).
- No se escribe nada dentro de la carpeta de NovTurnIA. Es sólo lectura.
- No se usa MFA por teléfono (SMS): es el único componente de pago, $75/mes y plan Pro.
- No se construyen las funciones internas de cada rol. La práctica dice explícitamente que
  basta con mostrar el nivel de acceso concedido.
- No se sube `.env.local` al repositorio.

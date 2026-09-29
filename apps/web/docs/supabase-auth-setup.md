# Autenticación y roles con Supabase

La aplicación usa Supabase Auth con Google y una tabla `public.profiles` como fuente de verdad para la autorización. El rol no se toma de `user_metadata`, porque ese dato puede ser modificado por el propio usuario.

## Roles

| Rol | Acceso |
| --- | --- |
| `medico` | Panel clínico, consultas, pacientes, notas, plantillas y crear una consulta. |
| `supervisor` | Lectura del panel clínico, auditoría, reportes y plantillas. No puede administrar cuentas ni configuración institucional. |
| `admin` | Administración de usuarios, configuración institucional, auditoría y reportes. No puede crear consultas clínicas. |

La navegación se oculta según el rol, pero la restricción real ocurre en el servidor, en `proxy.ts`, los layouts protegidos y las políticas RLS de Supabase.

## 1. Tener un proyecto Supabase activo

El proyecto debe estar activo antes de aplicar la migración. Si se crea uno nuevo, conserva su `project ref`; se usa para la URL, el callback de Google y el vínculo con la CLI.

## 2. Aplicar la migración

La migración está en `supabase/migrations/20260621041058_auth_profiles_and_roles.sql`. Crea:

- El enum `app_role` (`admin`, `supervisor`, `medico`).
- La tabla `profiles`, creada automáticamente después del primer login Google.
- RLS: una persona lee su perfil; los administradores pueden leer y cambiar roles.
- Un bloqueo para que nunca se elimine el último administrador.

Desde la raíz del proyecto, vincula el proyecto de Supabase y publica la migración:

```powershell
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Después del primer inicio de sesión, asigna el primer administrador en el SQL Editor de Supabase:

```sql
update public.profiles
set role = 'admin'
where email = 'correo-del-administrador@institucion.com';
```

Los siguientes roles se cambian en `/app/usuarios` con una sesión `admin`.

## 3. Configurar Google OAuth

En Google Cloud, crea un cliente OAuth de tipo **Web application**.

- Authorized JavaScript origins: `http://localhost:3000` y el origen de producción, por ejemplo `https://app.ejemplo.com`.
- Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
- Scopes: `openid`, `email` y `profile`.

En Supabase, ve a **Authentication → Providers → Google**, habilita el proveedor y pega el Client ID y Client Secret de Google.

En **Authentication → URL Configuration**, agrega estas redirect URLs:

```text
http://localhost:3000/auth/callback
https://<dominio-produccion>/auth/callback
```

## 4. Configurar la app

Copia `.env.example` como `.env.local` y reemplaza los valores:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

En Vercel, configura las mismas tres variables. Para producción, `NEXT_PUBLIC_SITE_URL` debe ser el dominio HTTPS final.

No agregues una clave `service_role` ni una clave secreta con prefijo `NEXT_PUBLIC_`.

## 5. Comprobación

1. Inicia `npm run dev` y abre `/login`.
2. Ingresa con Google; la cuenta se crea con rol `medico`.
3. En el SQL Editor asigna el primer `admin`.
4. Vuelve a entrar como administrador y abre `/app/usuarios`.
5. Cambia una cuenta a `supervisor` y confirma que no puede entrar a `/app/usuarios` ni `/app/configuracion`.
6. Confirma que un médico no puede entrar a `/app/auditoria` ni `/app/reportes`.

Las consultas, pacientes y notas del prototipo continúan usando datos de demostración. Antes de guardar información clínica real, hay que migrar esos modelos a tablas propias con RLS por institución y por usuario.

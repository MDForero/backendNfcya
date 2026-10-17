# Design

## Context

El backend es el esqueleto generado por `nest new` (NestJS 11, TypeScript, Jest, pnpm): solo `AppModule`, `AppController` y `AppService`. No hay base de datos, configuración por entorno, validación ni repositorio con commits. El frontend (Next.js 16 en `../frontend`) es independiente y consumirá esta API en un cambio posterior. Los requisitos de comportamiento están en `specs/identity/user-auth` y `specs/identity/access-control`; el porqué, en `proposal.md`.

Decisiones ya tomadas con el equipo: PostgreSQL + TypeORM, login con email/contraseña y Google, y cuatro roles (`SUPER_ADMIN`, `SOPORTE`, `EMPRESA`, `CLIENTE`).

## Goals / Non-Goals

**Goals:**
- Una sola fuente de identidad y autorización que los módulos futuros (perfiles, links, chips) reutilicen con decoradores, sin repetir lógica de permisos.
- Sesiones revocables al instante (suspensión, cambio de contraseña, robo de refresh token).
- Modelo de datos que admita más proveedores sociales sin migrar la tabla de usuarios.

**Non-Goals:**
- Permisos finos por recurso (ACL/ABAC) ni roles configurables desde la UI: los roles son un enum fijo.
- Varias organizaciones por usuario: un usuario pertenece a cero o una organización.
- Sesiones server-side con cookies de sesión clásicas.

## Decisions

### 1. Estructura de módulos
`ConfigModule` (global, validado con `class-validator` al arrancar), `DatabaseModule` (TypeORM), `UsersModule`, `OrganizationsModule`, `AuthModule`, `MailModule`, `AuditModule`. `AuthModule` depende de `UsersModule` y `MailModule`; las rutas administrativas viven en `UsersModule` (`/admin/users`) y `OrganizationsModule` (`/admin/organizations`).
*Alternativa:* un único módulo `auth` con todo. Descartada porque `users` y `organizations` crecerán con los perfiles y la gestión de empresas.

### 2. TypeORM con migraciones, sin `synchronize`
`DataSource` compartido entre la app y la CLI de TypeORM (`src/database/data-source.ts`); migraciones versionadas en `src/database/migrations`; `synchronize: false` en todos los entornos. Postgres local vía `docker-compose.yml`.
*Alternativa:* `synchronize: true` en desarrollo. Descartada: oculta diferencias entre entornos y la primera migración es justamente el modelo de identidad.

### 3. Modelo de datos
- `organizations`: `id` (uuid), `name`, `created_at`, `updated_at`.
- `users`: `id` (uuid), `email` (guardado en minúsculas, único), `name`, `password_hash` (nullable: cuentas solo-Google), `email_verified_at` (nullable), `role` (enum Postgres), `status` (`ACTIVA` | `SUSPENDIDA`), `organization_id` (FK nullable), timestamps. Restricción CHECK: `role <> 'EMPRESA' OR organization_id IS NOT NULL`.
- `user_identities`: `id`, `user_id`, `provider` (`google`), `provider_user_id` (el `sub` de Google), único por (`provider`, `provider_user_id`).
- `refresh_tokens`: `id`, `user_id`, `family_id`, `token_hash`, `expires_at`, `revoked_at`, `replaced_by_id`, `user_agent`, `ip`, `created_at`.
- `one_time_tokens`: `id`, `user_id`, `type` (`VERIFY_EMAIL` | `RESET_PASSWORD`), `token_hash`, `expires_at`, `used_at`.
- `login_attempts`: `email`, `ip`, `succeeded`, `created_at` (índice por email + fecha).
- `audit_logs`: `id`, `actor_id`, `target_user_id`, `action`, `before` (jsonb), `after` (jsonb), `created_at`.
*Alternativa:* columna `google_id` en `users`. Descartada por la meta de admitir más proveedores.

### 4. Hash de contraseñas con argon2id
Librería `argon2` con parámetros por defecto (argon2id). Los tokens opacos (refresh, verificación, recuperación) son 32 bytes aleatorios en base64url y se guardan como SHA-256: no requieren derivación lenta porque tienen alta entropía.
*Alternativa:* bcrypt. Viable, pero argon2id es la recomendación actual de OWASP y no trunca a 72 bytes.

### 5. Access token JWT + refresh token opaco en cookie
- Access token: JWT HS256 firmado con `JWT_ACCESS_SECRET`, 15 min, payload `{ sub, role }`. El frontend lo guarda en memoria y lo envía en `Authorization: Bearer`.
- Refresh token: opaco, 30 días, en cookie `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/auth`. `/auth/login`, `/auth/refresh` y el callback de Google la escriben; `/auth/logout` la borra.
- Rotación por familia: cada login crea un `family_id`; `/auth/refresh` revoca el token usado y crea uno nuevo en la misma familia. Si llega un token ya revocado por rotación, se revocan **todas** las familias del usuario (spec: reutilización).
*Alternativas:* refresh token también en JSON (más fácil para apps móviles, más expuesto a XSS) o JWT de larga duración sin refresh (no revocable). Se descartan; si aparece una app móvil se añade un modo "token en body" detrás de un header explícito.

### 6. Google OAuth con Passport y redirección sin tokens en la URL
`passport-google-oauth20` con `state` activado y scopes `openid email profile`. Flujo: `GET /auth/google` → Google → `GET /auth/google/callback`. En el callback se resuelve la cuenta (crear / vincular por email verificado / rechazar), se escribe la cookie de refresh y se redirige a `FRONTEND_URL/auth/callback`; el frontend obtiene su access token llamando a `/auth/refresh`. En error se redirige a `FRONTEND_URL/auth/callback?error=<código>`.
*Alternativa:* pasar el access token en el query string. Descartada: queda en historial y logs.

### 7. Guards globales y decoradores
- `JwtAuthGuard` global (`APP_GUARD`): valida el JWT y **carga el usuario de la base de datos** en cada petición; rechaza con 401 si no existe o está `SUSPENDIDA`. `@Public()` lo omite.
- `RolesGuard` global tras el anterior: lee `@Roles(...)`; sin decorador, cualquier autenticado pasa.
- `@CurrentUser()` inyecta la entidad cargada.
- El alcance por organización (EMPRESA → solo `CLIENTE` de su organización) no cabe en un guard genérico: se resuelve en `UsersService` con una función de política `canManage(actor, target)` y los listados se filtran en la consulta. Si no puede, se responde 404.
*Alternativa:* confiar en el rol del JWT sin consultar la BD. Más rápido, pero un rol cambiado o una suspensión seguirían vigentes hasta 15 min, lo que contradice la spec. El costo es una consulta por clave primaria por petición; aceptable en esta etapa.

### 8. Límite de intentos en dos capas
- `@nestjs/throttler` por IP en las rutas `/auth/*` (p. ej. 20 req/min) contra ráfagas.
- Bloqueo por email: antes de comprobar la contraseña se cuentan los fallos en `login_attempts` de los últimos 15 min; con 5 o más se responde 429. Se registran éxitos y fallos.
*Alternativa:* Redis. Innecesario con una sola instancia; se migra si se escala horizontalmente.

### 9. Respuestas que no revelan cuentas
Registro con email existente, reenvío de verificación y "olvidé mi contraseña" responden siempre `202` con el mismo cuerpo. El trabajo de correo se hace igual en ambos casos (se encola o se omite tras la respuesta) para no filtrar por tiempo.

### 10. Validación global
`ValidationPipe` global con `whitelist: true` y `transform: true` (sin `forbidNonWhitelisted`), así un `role` u `organizationId` enviado en el registro se descarta, como pide la spec.

### 11. Correo
`MailService` con una interfaz `MailTransport`; implementación SMTP con `nodemailer` y una implementación que escribe en el log cuando `MAIL_TRANSPORT=log` (desarrollo y tests). Plantillas simples en texto + HTML para verificación, recuperación y aviso de intento de registro.

### 12. Bootstrap del SUPER_ADMIN
Script `pnpm seed:admin` (`NestFactory.createApplicationContext`) que lee `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` y es idempotente.
*Alternativa:* crearlo al arrancar la app. Descartada para no tener credenciales de administrador como variables permanentes del servicio en producción.

### 13. Superficie de API

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/auth/register` | público |
| POST | `/auth/verify-email` | público |
| POST | `/auth/resend-verification` | público |
| POST | `/auth/login` | público |
| GET | `/auth/google`, `/auth/google/callback` | público |
| POST | `/auth/refresh` | público (cookie) |
| POST | `/auth/logout`, `/auth/logout-all` | autenticado |
| POST | `/auth/forgot-password`, `/auth/reset-password` | público |
| POST | `/auth/change-password` | autenticado |
| GET / PATCH | `/users/me` | autenticado |
| GET | `/admin/users`, `/admin/users/:id` | SUPER_ADMIN, SOPORTE, EMPRESA (acotado) |
| PATCH | `/admin/users/:id/role`, `/admin/users/:id/organization` | SUPER_ADMIN |
| POST | `/admin/users/:id/suspend`, `/admin/users/:id/reactivate` | SUPER_ADMIN, EMPRESA (acotado) |
| POST | `/admin/users/:id/resend-verification`, `/admin/users/:id/send-password-reset` | SUPER_ADMIN, SOPORTE |
| GET / POST / PATCH | `/admin/organizations` | GET: SUPER_ADMIN, SOPORTE · POST/PATCH: SUPER_ADMIN |

CORS habilitado solo para `FRONTEND_URL` con `credentials: true`; `cookie-parser` para leer la cookie de refresh.

## Risks / Trade-offs

- [Consulta de usuario en cada petición] → Por clave primaria con índice; si molesta, caché en memoria de pocos segundos invalidada al cambiar rol o estado.
- [Cookie `SameSite=Lax` exige que frontend y API compartan sitio (p. ej. `app.nfcya.com` y `api.nfcya.com`)] → Si quedan en dominios distintos habrá que usar `SameSite=None` más un header anti-CSRF en `/auth/refresh`; queda parametrizado por entorno.
- [Vincular Google por email puede asociar una cuenta a quien controle ese email] → Solo se vincula si Google marca el email como verificado; además se envía un aviso al usuario cuando se vincula un proveedor nuevo.
- [Bloqueo por email permite que un atacante bloquee la cuenta de otro durante 15 min] → Bloqueo temporal corto y throttling por IP; aceptado frente al riesgo de fuerza bruta.
- [`login_attempts` y tokens caducados crecen sin límite] → Tarea de limpieza periódica (registros de más de 30 días) incluida en las tareas.
- [Throttler y bloqueo en memoria/BD no se comparten entre instancias] → Válido mientras haya una instancia; documentado para cuando se escale.

## Migration Plan

Proyecto nuevo, sin datos que migrar:
1. Levantar Postgres (`docker compose up -d`) y configurar `.env` a partir de `.env.example`.
2. Ejecutar `pnpm migration:run`.
3. Ejecutar `pnpm seed:admin` una vez con las variables de bootstrap y retirarlas después.
4. Registrar en Google Cloud la URL de callback de cada entorno.

Rollback: `pnpm migration:revert` deshace la migración inicial; no hay consumidores de la API todavía.

## Open Questions

- Dominios definitivos de frontend y API (decide el valor de `SameSite` y del dominio de la cookie; está parametrizado).
- Proveedor de correo de producción (SMTP propio, Resend, SES…): solo cambia la configuración del transporte.

# nfcYA — Backend

API de nfcYA (NestJS 11 + PostgreSQL + TypeORM). Cubre identidad y control de acceso (registro, login con email/contraseña y Google, refresh token rotativo, recuperación de contraseña, roles) y el producto: perfil digital con slug público, enlaces, códigos NFC/QR, vCard, captura de leads con consentimiento y administración de perfiles.

Los requisitos están en [`openspec/`](openspec/): especificaciones vigentes en `openspec/specs/` (identidad y acceso, perfiles, NFC/QR, leads, administración). Los cambios `add-auth-and-roles` y `complete-nfcya-mvp` están archivados en `openspec/changes/archive/`; las decisiones de diseño están en `openspec/changes/archive/2026-11-13-complete-nfcya-mvp/design.md`.

## Puesta en marcha

Requisitos: Node 22, pnpm y PostgreSQL 13 o superior.

1. **Base de datos.** Usa tu PostgreSQL local o el de Docker.

   - **Local:** crea el usuario y las dos bases como superusuario:

     ```sql
     CREATE ROLE nfcya LOGIN PASSWORD 'nfcya';
     CREATE DATABASE nfcya OWNER nfcya;
     CREATE DATABASE nfcya_test OWNER nfcya;
     ```

   - **Docker:** `docker compose up -d` levanta Postgres en el puerto **5433** con ambas bases ya creadas. Usa `localhost:5433` en `DATABASE_URL`.

2. **Variables de entorno.**

   ```bash
   cp .env.example .env
   ```

   Ajusta `DATABASE_URL` y genera un `JWT_ACCESS_SECRET`:

   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

   Para los tests e2e crea `.env.test`, una copia de `.env` con `NODE_ENV=test` y `DATABASE_URL` apuntando a una base cuyo nombre termine en `_test`. Los tests la borran y la recrean en cada corrida.

3. **Dependencias y migraciones.**

   ```bash
   pnpm install
   pnpm migration:run
   ```

4. **Primer SUPER_ADMIN.** Ejecútalo una vez y luego retira las variables del entorno:

   ```bash
   BOOTSTRAP_ADMIN_EMAIL=admin@tu-dominio.com BOOTSTRAP_ADMIN_PASSWORD='UnaClaveSegura1' pnpm seed:admin
   ```

   Es idempotente: si ya hay un `SUPER_ADMIN`, no cambia nada.

5. **Arrancar.**

   ```bash
   pnpm start:dev
   ```

   La API queda en `http://localhost:3001` (`PORT`; el frontend usa el 3000). Con `MAIL_TRANSPORT=log` los correos (verificación, recuperación) se escriben en la consola con su enlace.

## Scripts

| Script | Qué hace |
|---|---|
| `pnpm start:dev` | API con recarga en caliente |
| `pnpm build` / `pnpm start:prod` | Compila y ejecuta `dist/` |
| `pnpm test` | Tests unitarios |
| `pnpm test:e2e` | Tests e2e contra la base de `.env.test` |
| `pnpm lint` | ESLint + Prettier |
| `pnpm migration:run` / `migration:revert` / `migration:show` | Migraciones |
| `pnpm migration:generate src/database/migrations/<Nombre>` | Genera una migración a partir de las entidades |
| `pnpm seed:admin` | Crea el primer `SUPER_ADMIN` |
| `pnpm seed:demo` | Datos de demostración (requiere `DEMO_PASSWORD`; idempotente; no corre en producción). Ver el guion en `frontend/openspec/changes/archive/2026-11-13-complete-nfcya-mvp/demo.md` |

Cada migración nueva se registra a mano en `src/database/migrations/index.ts`. `synchronize` está desactivado en todos los entornos.

## Login con Google

Sin `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `GOOGLE_CALLBACK_URL`, el login con Google queda deshabilitado: `/auth/google` redirige al frontend con `?error=google_disabled`. Para activarlo:

1. En [Google Cloud Console](https://console.cloud.google.com/), crea o elige un proyecto y ve a **APIs y servicios → Pantalla de consentimiento de OAuth**. Configúrala como *Externa*, con los scopes `openid`, `email` y `profile`. Mientras esté en modo de prueba, agrega tus cuentas como usuarios de prueba.
2. En **Credenciales → Crear credenciales → ID de cliente de OAuth**, elige el tipo *Aplicación web* y configura:
   - **URI de redirección autorizados:** la URL de callback de la API de cada entorno, por ejemplo `http://localhost:3001/auth/google/callback` en local o `https://api.nfcya.com/auth/google/callback` en producción.
3. Copia el ID y el secreto en `.env`:

   ```dotenv
   GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=xxxx
   GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
   ```

4. Reinicia la API y abre `http://localhost:3001/auth/google` en el navegador. Después de elegir la cuenta, Google redirige a `FRONTEND_URL/auth/callback`, con la cookie de sesión ya escrita o con `?error=<código>`.

El frontend nunca recibe tokens por la URL. En `/auth/callback` llama a `POST /auth/refresh` con `credentials: 'include'` para obtener el access token.

Códigos de error del callback: `google_disabled`, `oauth_failed` (canceló o el `state` no coincide), `email_not_verified` y `account_suspended`.

En el frontend, el botón «Continuar con Google» solo aparece con `NEXT_PUBLIC_GOOGLE_LOGIN=true` en su `.env.local`. Actívalo cuando las credenciales estén configuradas y probadas.

## Autenticación y sesión

- **Access token:** JWT HS256 de 15 minutos. Se envía en `Authorization: Bearer <token>` y el frontend lo guarda solo en memoria.
- **Refresh token:** opaco, 30 días, en la cookie `httpOnly` `nfcya_rt` (`Path=/auth`).
  - `POST /auth/refresh` lo rota.
  - Si se reutiliza uno ya rotado, se revocan todas las sesiones del usuario.
- **Cookie entre dominios:** con frontend y API en subdominios del mismo sitio (`app.` y `api.`), basta `COOKIE_SAMESITE=lax`; `COOKIE_DOMAIN` solo hace falta para compartir la cookie entre subdominios. En sitios distintos se necesita `COOKIE_SAMESITE=none` con `COOKIE_SECURE=true`.
- **Respuestas genéricas:** registro, reenvío de verificación y recuperación de contraseña responden siempre `202` con el mismo cuerpo, para no revelar qué emails existen.
- **Límites:** se bloquea un email por 15 minutos tras 5 fallos de login. Además hay un límite por IP en `/auth/*` (`AUTH_THROTTLE_LIMIT`, 20/min por ruta). Renovar y cerrar sesión (`/auth/refresh`, `/auth/logout`, `/auth/logout-all`) tienen un límite propio más alto (`AUTH_SESSION_THROTTLE_LIMIT`, 300/min), porque cada carga de página renueva la sesión y una oficina comparte IP pública; el refresh token es aleatorio, así que no hay riesgo de fuerza bruta. Si el frontend recibe un 429 al renovar, reintenta y no cierra la sesión.
- **Códigos de error estables (`code`):** `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_SUSPENDED`, `TOO_MANY_ATTEMPTS`, `INVALID_TOKEN` e `INVALID_SESSION`.

## Roles

| Rol | Alcance |
|---|---|
| `SUPER_ADMIN` | Todo: usuarios, roles, organizaciones, suspender y reactivar |
| `SOPORTE` | Ver usuarios y organizaciones; reenviar verificación y enviar recuperación |
| `EMPRESA` | Ver, suspender y reactivar a los `CLIENTE` de su organización (fuera de ella recibe 404) |
| `CLIENTE` | Solo su propia cuenta |

El rol y el estado se leen de la base de datos en cada petición: un cambio de rol o una suspensión aplican de inmediato. Todas las rutas exigen sesión salvo las marcadas con `@Public()`. Para restringir una ruta a ciertos roles se usa `@Roles(...)`.

## Endpoints

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
| GET | `/admin/organizations` | SUPER_ADMIN, SOPORTE |
| POST / PATCH | `/admin/organizations`, `/admin/organizations/:id` | SUPER_ADMIN |

| POST | `/profiles` | CLIENTE, EMPRESA (un perfil por usuario) |
| GET / PATCH | `/profiles/me` | CLIENTE, EMPRESA |
| GET | `/profiles/slug-availability?slug=` | CLIENTE, EMPRESA |
| POST | `/profiles/me/publish`, `/profiles/me/unpublish` | CLIENTE, EMPRESA |
| GET / POST | `/profiles/me/links` | CLIENTE, EMPRESA |
| PATCH | `/profiles/me/links/reorder` (body `{ ids }` con todos los enlaces) | CLIENTE, EMPRESA |
| PATCH / DELETE | `/profiles/me/links/:id` | CLIENTE, EMPRESA |
| GET / POST | `/profiles/me/identifiers` | CLIENTE, EMPRESA |
| PATCH | `/profiles/me/identifiers/:id/status` (`ACTIVE`/`INACTIVE`/`REVOKED`) | CLIENTE, EMPRESA |
| GET / DELETE | `/profiles/me/leads`, `/profiles/me/leads/:id` | CLIENTE, EMPRESA |
| GET | `/profiles/public/:slug`, `/profiles/public/:slug/vcard` | público, rate limit |
| GET | `/resolve/:code` | público, rate limit |
| GET | `/profiles/public/leads/consent` | público |
| POST | `/profiles/public/:slug/leads` | público, rate limit estricto |
| GET | `/admin/profiles`, `/admin/profiles/:id` | SUPER_ADMIN, SOPORTE, EMPRESA (acotado) |
| POST | `/admin/profiles/:id/suspend`, `/admin/profiles/:id/reactivate` | SUPER_ADMIN, EMPRESA (acotado), auditado |
| GET | `/admin/profiles/:id/leads` | SUPER_ADMIN |

`GET /admin/users` acepta `page`, `pageSize` (máximo 100), `role`, `status`, `organizationId` y `search` (nombre o email).

Los enlaces de los correos apuntan al frontend: `FRONTEND_URL/auth/verify-email?token=…` y `FRONTEND_URL/auth/reset-password?token=…`. El frontend envía ese token a `POST /auth/verify-email` o a `POST /auth/reset-password`.

## Perfiles, NFC/QR y leads

- **Perfil**: un usuario `CLIENTE`/`EMPRESA` crea un borrador; el slug se normaliza (`"Juan Pérez"` → `juan-perez`) y es único en BD. Solo los perfiles `PUBLISHED` con propietario activo son públicos; borrador, suspendido o inexistente responden igual (404).
- **Privacidad**: la respuesta pública es una lista explícita de campos, sin IDs. Email y teléfono solo salen si el propietario activa `showEmail`/`showPhone` (también en la vCard).
- **Rutas `/profiles/me/*`**: nunca reciben el ID del perfil; se deriva del usuario autenticado. Enlaces, códigos o leads ajenos responden 404.
- **URLs**: solo `http(s)`, `mailto:` y `tel:` en enlaces; `https` en imágenes. Se rechazan `javascript:`, `data:`, credenciales en la URL, etc.
- **NFC/QR**: cada código es aleatorio (96 bits) y forma la URL `PUBLIC_BASE_URL/r/:code` (o `FRONTEND_URL` si no se define). El frontend la resuelve con `GET /resolve/:code`. `INACTIVE` es reversible y `REVOKED` definitivo. El chip NFC solo guarda esa URL.
- **Leads**: desactivados por defecto (`leadsEnabled`). Exigen `consentAccepted: true` y email o teléfono; sin consentimiento no se guarda nada.
- **Suspensión**: `SUPER_ADMIN` (o `EMPRESA` sobre sus clientes) suspende un perfil: deja de ser público, el propietario no puede publicarlo y se registra en `audit_logs`. Reactivar lo deja en borrador.
- **Rate limit por IP**: `PUBLIC_THROTTLE_LIMIT` (60/min) en perfil público, vCard y `/resolve`; `LEADS_THROTTLE_LIMIT` (5/min) en leads. Detrás de un proxy (Nginx, balanceador) hay que poner `TRUST_PROXY=1` (número de saltos) para que la IP sea la del visitante; si no, todos los usuarios comparten el contador de la IP del proxy.

## Pruebas

```bash
pnpm test        # unitarias: slug, URLs seguras, vCard, policies, config…
pnpm test:e2e    # e2e contra .env.test: auth, sesiones, roles, perfiles, enlaces, NFC/QR, vCard, leads, admin, CORS, rate limit
```

La suite e2e borra y recrea el esquema de la base `_test` y aplica todas las migraciones, así que también valida que las migraciones funcionan desde una BD vacía.

## Limitaciones conocidas

- Login con Google real sin probar por falta de credenciales (tarea 8.3 de `add-auth-and-roles`).
- Las imágenes son URLs externas `https`; no hay subida ni almacenamiento propio.
- QR estático (el código no cambia de destino); sin analítica de escaneos.
- El rate limit guarda los contadores en memoria: con varias instancias haría falta un store compartido (Redis).
- Pendientes fuera del MVP: membresías, pagos Wompi, facturación DIAN, exportación a Google Contacts, app móvil.

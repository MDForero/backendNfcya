# Matriz endpoint – pantalla – rol – prueba

Pruebas: **U** = unitaria (`backend/src/**/*.spec.ts`), **E** = e2e backend (`backend/test/*.e2e-spec.ts`), **S** = smoke en navegador (`frontend/e2e/smoke.mjs`). Roles: SA = SUPER_ADMIN, SO = SOPORTE, EM = EMPRESA, CL = CLIENTE.

| Endpoint | Pantalla | Roles | Pruebas |
|---|---|---|---|
| `POST /auth/login` | `/login` | público | E `sessions` · S login válido/inválido sin refresh |
| `POST /auth/refresh` | todas (AuthProvider) | cookie | E `sessions` (rotación, reutilización) · S recarga = 1 refresh; páginas públicas sin refresh |
| `POST /auth/logout`, `/logout-all` | menú de cuenta | autenticado | E `sessions` · S logout → `/login` |
| `POST /profiles` | `/profile` (nuevo) | CL, EM | E creación, 401 sin sesión, 403 SO/SA, 409 doble perfil, validaciones · S crear borrador |
| `GET/PATCH /profiles/me` | `/profile`, `/dashboard` | CL, EM | E PATCH parcial, campos protegidos, 404 sin perfil · S |
| `GET /profiles/slug-availability` | `/profile` (slug en vivo) | CL, EM | U `slug.util` · E libre/propio/ocupado/reservado · S disponible / ocupado |
| `POST /profiles/me/publish`, `/unpublish` | `/profile` | CL, EM | E publicar, despublicar, 403 suspendido · S |
| `GET/POST /profiles/me/links` | `/links` | CL, EM | U `safe-url` · E CRUD, URLs peligrosas, límite 20 · S crear, `javascript:` rechazada |
| `PATCH/DELETE /profiles/me/links/:id` | `/links` | CL, EM | E acceso cruzado → 404 · S ocultar |
| `PATCH /profiles/me/links/reorder` | `/links` (subir/bajar) | CL, EM | E orden, IDs ajenos/faltantes → 400 · S reordenar |
| `GET/POST /profiles/me/identifiers` | `/nfc-qr` | CL, EM | E código opaco y único · S crear NFC, QR PNG |
| `PATCH /profiles/me/identifiers/:id/status` | `/nfc-qr` | CL, EM | E desactivar/reactivar, revocar definitivo, ajeno → 404 · S desactivar |
| `GET /resolve/:code` | `/r/:code` | público | E activo/inactivo/revocado/no publicado/mal formado, rate limit · S `/r` → `/p?src=nfc` |
| `GET /profiles/public/:slug` | `/p/:slug` | público | E lista permitida, borrador/suspendido/cuenta suspendida → 404 · S móvil, privacidad, sin scroll horizontal |
| `GET /profiles/public/:slug/vcard` | `/p/:slug` (Guardar contacto) | público | U `vcard.util` · E cabeceras, campos autorizados · S descarga |
| `GET /profiles/public/leads/consent` | `/p/:slug` (formulario) | público | S texto mostrado |
| `POST /profiles/public/:slug/leads` | `/p/:slug` (Déjame tus datos) | público | E consentimiento, validación, rate limit · S con/sin consentimiento |
| `GET/DELETE /profiles/me/leads` | `/leads` | CL, EM | E aislamiento por propietario · S lead con fuente NFC |
| `GET /admin/profiles` | `/admin/profiles` | SA, SO, EM (acotado) | E filtros, búsqueda, ámbito EMPRESA, 403 CL · S búsqueda (móvil), CL sin permisos |
| `POST /admin/profiles/:id/suspend`, `/reactivate` | `/admin/profiles` | SA, EM (acotado) | E auditoría, 403 SO, 404 fuera de ámbito · S suspensión auditada oculta el perfil |
| `GET /admin/profiles/:id/leads` | — (solo API) | SA | E 403 SO/CL |
| `GET /admin/users`, `/admin/users/:id` | `/admin/users` | SA, SO, EM (acotado) | E filtros, ámbito EMPRESA, 404 fuera de ámbito · S búsqueda (móvil), CL sin permisos |
| `POST /admin/users` | `/admin/users` (Nuevo administrador) | SA | E invitación 72 h, auditoría `USER_CREATED`, 409 email, 400 rol, 403 SO/EM/CL · S crear e ingresar con el enlace |
| `DELETE /admin/users/:id` | `/admin/users` (Gestionar → Eliminar) | SA | E cascada, acceso cortado, auditoría `USER_DELETED`, 400 propio, último SA, 403 SO/EM/CL · S confirmación por email |
| `PATCH /admin/users/:id/role`, `/organization` | `/admin/users` (Gestionar) | SA | E auditoría, último SA, EMPRESA exige organización |
| `POST /admin/users/:id/suspend`, `/reactivate` | `/admin/users` (Gestionar) | SA, EM (acotado) | E revoca sesiones, auditoría, 403 SO |
| `POST /admin/users/:id/resend-verification`, `/send-password-reset` | `/admin/users` (Gestionar) | SA, SO | E 409 ya verificado, 403 EM/CL |

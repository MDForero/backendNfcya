# Tasks

## 1. Infraestructura base

- [x] 1.1 Instalar dependencias (`@nestjs/config`, `@nestjs/typeorm`, `typeorm`, `pg`, `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `passport-google-oauth20`, `argon2`, `class-validator`, `class-transformer`, `@nestjs/throttler`, `cookie-parser`, `nodemailer` y sus `@types`) con pnpm y verificar que `pnpm build` compila
- [x] 1.2 Añadir `docker-compose.yml` con Postgres y `.env.example` con todas las variables (DB, JWT, Google, mail, `FRONTEND_URL`, cookie, bootstrap); verificar que `docker compose up -d` deja la base aceptando conexiones
- [x] 1.3 Configurar `ConfigModule` global con validación del entorno al arrancar; verificar con un test unitario que falta una variable obligatoria hace fallar la validación
- [x] 1.4 Configurar `DatabaseModule` con TypeORM (`synchronize: false`), `data-source.ts` compartido y scripts `migration:generate`, `migration:run`, `migration:revert`; verificar que `pnpm migration:run` corre sin migraciones pendientes
- [x] 1.5 Configurar en `main.ts` `ValidationPipe` global (`whitelist`, `transform`), `cookie-parser` y CORS restringido a `FRONTEND_URL` con credenciales; verificar con un e2e que un campo no declarado en un DTO se descarta

## 2. Modelo de datos

- [x] 2.1 Crear entidades `Organization`, `User` (enums `Role` y `UserStatus`, email en minúsculas), `UserIdentity`, `RefreshToken`, `OneTimeToken`, `LoginAttempt` y `AuditLog` según design.md §3; verificar que `pnpm build` compila
- [x] 2.2 Generar la migración inicial con índices únicos y el CHECK de `EMPRESA` con organización; verificar que `migration:run` y `migration:revert` funcionan contra la base local
- [x] 2.3 Preparar la base de datos de test para e2e (esquema aislado y limpieza entre suites); verificar que `pnpm test:e2e` arranca contra ella

## 3. Correo

- [x] 3.1 Implementar `MailModule` con interfaz `MailTransport`, transporte SMTP (nodemailer) y transporte `log`; verificar con un test unitario que `MAIL_TRANSPORT=log` registra el mensaje sin enviar
- [x] 3.2 Crear plantillas de verificación de email, recuperación de contraseña, aviso de intento de registro y aviso de proveedor vinculado; verificar con tests unitarios que cada una incluye el enlace correcto a `FRONTEND_URL`

## 4. Registro y verificación de email

- [x] 4.1 Implementar `UsersService` (crear, buscar por email normalizado, buscar por id) y utilidades de hash de contraseña (argon2id) y de tokens opacos (generar + SHA-256); verificar con tests unitarios
- [x] 4.2 Implementar `POST /auth/register` con DTO validado (reglas de contraseña), rol `CLIENTE` forzado y respuesta 202 idéntica para email existente; verificar con e2e los escenarios de la spec "Registro con email y contraseña"
- [x] 4.3 Implementar `POST /auth/verify-email` y `POST /auth/resend-verification` con tokens de un solo uso de 24 h; verificar con e2e los escenarios de "Verificación de email"

## 5. Login, sesión y tokens

- [x] 5.1 Implementar emisión de access token (JWT 15 min, `{ sub, role }`) y de refresh token opaco por familia en cookie `httpOnly` (`Path=/auth`); verificar con tests unitarios la expiración y los atributos de la cookie
- [x] 5.2 Implementar `POST /auth/login` con mensaje genérico, rechazo por email no verificado o cuenta suspendida, y registro en `login_attempts`; verificar con e2e los escenarios de "Inicio de sesión con email y contraseña"
- [x] 5.3 Implementar el bloqueo por email (5 fallos / 15 min → 429) y `@nestjs/throttler` por IP en `/auth/*`; verificar con e2e el escenario "Exceso de intentos"
- [x] 5.4 Implementar `POST /auth/refresh` con rotación, detección de reutilización (revoca todas las sesiones) y rechazo de cuentas suspendidas; verificar con e2e los escenarios de "Renovación y rotación del refresh token"
- [x] 5.5 Implementar `POST /auth/logout` y `POST /auth/logout-all`; verificar con e2e que el refresh token revocado ya no renueva
- [x] 5.6 Implementar `GET /users/me` y `PATCH /users/me` (solo nombre) sin campos secretos; verificar con e2e "Consulta de perfil propio" y "Acceso a cuenta propia"

## 6. Guards y autorización

- [x] 6.1 Implementar `JwtAuthGuard` global que carga el usuario de la BD y rechaza suspendidos, decorador `@Public()` y `@CurrentUser()`; verificar con e2e "Token ausente, inválido o expirado" y "Suspensión con token vigente"
- [x] 6.2 Implementar `RolesGuard` global y decorador `@Roles()`; verificar con e2e "Rol permitido", "Rol no permitido" y "Rol cambiado con token vigente"
- [x] 6.3 Implementar la política `canManage(actor, target)` y el filtro de listados por organización para `EMPRESA` (404 fuera de alcance); verificar con tests unitarios la matriz rol × objetivo

## 7. Recuperación y cambio de contraseña

- [x] 7.1 Implementar `POST /auth/forgot-password` y `POST /auth/reset-password` (token de 1 h, revoca todas las sesiones, habilita contraseña en cuentas solo-Google); verificar con e2e los escenarios de "Recuperación de contraseña"
- [x] 7.2 Implementar `POST /auth/change-password` que revoca las demás sesiones y conserva la actual; verificar con e2e los escenarios de "Cambio de contraseña autenticado"

## 8. Login con Google

- [x] 8.1 Implementar la estrategia `passport-google-oauth20` con `state`, y las rutas `GET /auth/google` y `GET /auth/google/callback` que escriben la cookie de refresh y redirigen a `FRONTEND_URL/auth/callback`; verificar con tests unitarios del callback usando un perfil de Google simulado
- [x] 8.2 Implementar la resolución de cuenta (crear `CLIENTE` verificado, vincular por email verificado con aviso por correo, rechazar email no verificado o cuenta suspendida, redirigir con `?error=` al cancelar); verificar con tests de integración los escenarios de "Inicio de sesión con Google"
- [ ] 8.3 Documentar en el README la configuración de credenciales y URLs de callback en Google Cloud; verificar siguiendo los pasos un login real en local

## 9. Administración de usuarios y organizaciones

- [x] 9.1 Implementar `AuditModule` y su registro para cambios de rol, organización, suspensión y reactivación; verificar con test unitario el contenido del registro
- [x] 9.2 Implementar `GET /admin/organizations` (SUPER_ADMIN, SOPORTE) y `POST/PATCH /admin/organizations` (SUPER_ADMIN); verificar con e2e "Crear organización" y el 403 para otros roles
- [x] 9.3 Implementar `GET /admin/users` (paginación y filtros) y `GET /admin/users/:id` con alcance por rol; verificar con e2e "Gestión global de usuarios", "Consulta de soporte" y "Listar miembros"
- [x] 9.4 Implementar `PATCH /admin/users/:id/role` y `PATCH /admin/users/:id/organization` (solo SUPER_ADMIN, EMPRESA requiere organización, sin auto-degradación, nunca cero SUPER_ADMIN activos); verificar con e2e los escenarios de "Cambio de rol" y "Cambio auditado"
- [x] 9.5 Implementar `POST /admin/users/:id/suspend` y `/reactivate` (SUPER_ADMIN global, EMPRESA acotado, sin auto-suspensión, revoca sesiones); verificar con e2e los escenarios de "Suspensión y reactivación de cuentas" y "Suspender miembro"
- [x] 9.6 Implementar `POST /admin/users/:id/resend-verification` y `/send-password-reset` (SUPER_ADMIN, SOPORTE); verificar con e2e "Acción de asistencia" y "Acción fuera de su alcance"

## 10. Bootstrap y mantenimiento

- [x] 10.1 Implementar el script `pnpm seed:admin` idempotente; verificar con test de integración "Plataforma sin administrador" y "Administrador ya existente"
- [x] 10.2 Implementar la limpieza periódica de `login_attempts`, refresh tokens y tokens de un solo uso vencidos hace más de 30 días; verificar con test unitario que solo borra registros antiguos
- [x] 10.3 Reemplazar el README genérico de Nest con la puesta en marcha (docker, `.env`, migraciones, seed) y la tabla de endpoints; verificar levantando el proyecto desde cero con esas instrucciones

## 11. Verificación integral

- [x] 11.1 Ejecutar `pnpm lint`, `pnpm test` y `pnpm test:e2e` sin fallos
- [x] 11.2 Recorrer el flujo completo en local (registro → verificación → login → refresh → logout; Google; admin cambia rol y suspende) y verificar que no aparecen contraseñas ni tokens en texto plano en la base de datos ni en los logs

## Workflow follow-up

- Archivar el cambio con `/opsx:archive` cuando se haya revisado e integrado.

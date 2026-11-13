# Tasks: completar NFCYa — backend

Marcar como completada solo con evidencia en código y pruebas. Numeración del paquete original; las tareas de frontend están en `frontend/openspec/changes/complete-nfcya-mvp/tasks.md`.

## Estado al 2026-11-13
- **Avance:** 51/54 tareas. Pendientes: 1.2 (Google OAuth real, faltan credenciales), 7.5 (HTTPS/CORS/cookies con dominio público, falta entorno), 7.10 (archivar al cerrar).
- **Pruebas (2026-11-13):** unitarias 101/101, e2e 174/174, lint ✅, smoke en navegador 45/45, auth-smoke 28/28.
- **Decisiones de alcance (2026-11-12):** 7.5 (despliegue) se coordinará con el equipo de desarrollo fuera de la práctica; membresías y Wompi (8.1, 8.2) no se desarrollan por tiempo. El MVP se considera funcional.
- **Migraciones:** `InitIdentity`, `ProfilesMvp`, `AdminUserLifecycle` (aplicadas en desarrollo).
- **Últimos cambios:** revisión de integridad de la BD (11-11), alta de administradores por invitación y eliminación de usuarios (6.7, 11-12).
- **Fuera de alcance / backlog:** ver `design.md` → «Backlog no entregado».

## 0. Inspección y línea base
- [x] 0.1 Revisar repositorios, ramas y cambios OpenSpec existentes.
- [x] 0.2 Ejecutar instalación, lint, pruebas backend, pruebas frontend y build. — 2026-11-09: build/lint OK, 55/55 unit, 103/103 e2e; frontend build+lint OK.
- [x] 0.3 Registrar errores preexistentes. — sin errores preexistentes en build, lint ni pruebas.
- [x] 0.4 Confirmar prefijo API, CORS, puertos, cookies y variables de entorno. — sin prefijo global; API :3001 (`.env`), frontend :3000; CORS = `FRONTEND_URL` con credenciales; cookie `nfcya_rt` httpOnly, path `/auth`, `secure`/`sameSite` por env.
- [x] 0.5 Confirmar regla perfil personal/empresa, dominio público y almacenamiento de imágenes con supervisor. — confirmado por el supervisor el 2026-11-09 (un perfil por usuario, dominio vía `PUBLIC_BASE_URL`, imágenes como URLs externas); ver design.md.
- [x] 0.6 Crear matriz endpoint-pantalla-rol-prueba. — `matrix.md`.

## 1. P0 — Autenticación e integración
- [x] 1.1 Verificar estado real de `add-auth-and-roles`; no duplicar.
- [ ] 1.2 Configurar y probar Google OAuth real si existen credenciales. — integración frontend lista (botón + `/auth/callback`, probado con `google_disabled`); falta login real con credenciales (8.3 de `add-auth-and-roles`).
- [x] 1.3 Verificar cookie `nfcya_rt`, httpOnly, secure por entorno, sameSite, path y expiración. — `test/sessions.e2e-spec.ts`.
- [x] 1.4 Verificar CORS con credenciales y orígenes explícitos. — `test/cors.e2e-spec.ts`.
- [x] 1.5 Probar rotación, revocación, logout y logout-all. — `test/sessions.e2e-spec.ts`.
- [x] 1.6 Revisar autorización en rutas administrativas. — `test/authorization.e2e-spec.ts`, `test/admin.e2e-spec.ts`, `test/profiles.e2e-spec.ts`.

## 2. P0 — Perfiles digitales
- [x] 2.1 Crear entidad/migración Profile y relación usuario/organización. — migración `1794247996513-ProfilesMvp`.
- [x] 2.2 Crear DTOs de creación, actualización y respuesta pública.
- [x] 2.3 Crear perfil borrador para usuario autorizado.
- [x] 2.4 Consultar y actualizar perfil propio.
- [x] 2.5 Normalizar slug y garantizar unicidad en BD.
- [x] 2.6 Endpoint de disponibilidad de slug.
- [x] 2.7 Publicar/despublicar con validaciones.
- [x] 2.8 Endpoint público por slug con allowlist de campos.
- [x] 2.9 Probar usuario no autenticado, usuario ajeno, empresa y roles admin. — `test/profiles.e2e-spec.ts`.

## 3. P0 — Enlaces
- [x] 3.1 Crear entidad/migración ProfileLink.
- [x] 3.2 CRUD de enlaces con verificación de propiedad.
- [x] 3.3 Validar URL, protocolo, etiqueta, tipo y longitud.
- [x] 3.4 Activar/desactivar enlaces.
- [x] 3.5 Reordenamiento transaccional validando que todos los IDs sean del perfil.
- [x] 3.6 Incluir solo enlaces activos y ordenados en perfil público.
- [x] 3.7 Pruebas de validación, orden y acceso cruzado. — `test/profiles.e2e-spec.ts`, `src/profiles/safe-url.spec.ts`.

## 4. P0 — NFC y QR
- [x] 4.1 Crear entidad/mecanismo de identificadores.
- [x] 4.2 Generar código público aleatorio, opaco y único.
- [x] 4.3 Crear identificador asociado al perfil propio.
- [x] 4.4 Listar identificadores propios.
- [x] 4.5 Desactivar/revocar identificador.
- [x] 4.6 Resolver código activo a perfil publicado.
- [x] 4.7 Rechazar código inexistente, revocado o perfil no publicado.
- [x] 4.8 Aplicar rate limit y pruebas E2E. — `test/public-throttle.e2e-spec.ts`, `test/profiles.e2e-spec.ts`.

## 5. P1 — vCard y leads
- [x] 5.1 Backend: generar vCard solo con campos públicos y escapar caracteres. — `src/profiles/vcard.util.spec.ts`.
- [x] 5.2 Backend: configurar Content-Type y nombre de archivo.
- [x] 5.6 Backend: validar, limitar frecuencia y guardar fuente/fecha.
- [x] 5.7 Backend: restringir consulta al propietario/rol autorizado. — `/profiles/me/leads` (propietario) y `/admin/profiles/:id/leads` (SUPER_ADMIN).

## 6. P1 — Administración mínima
- [x] 6.1 Revisar endpoints admin existentes antes de crear otros.
- [x] 6.2 Backend: listado de perfiles con filtros/paginación y permisos.
- [x] 6.3 Backend: suspender/reactivar perfil y auditar acción.
- [x] 6.6 Probar rol no autorizado y aislamiento por organización. — `test/profiles.e2e-spec.ts` (Administración de perfiles).
- [x] 6.7 Backend: alta de `SUPER_ADMIN`/`SOPORTE` por invitación (`POST /admin/users`) y eliminación definitiva de usuarios (`DELETE /admin/users/:id`), auditadas (`USER_CREATED`/`USER_DELETED`, migración `AdminUserLifecycle`). — `test/admin.e2e-spec.ts` (alta de administradores, eliminación de usuarios): 7 casos; e2e 174/174.

## 7. Calidad y entrega
- [x] 7.1 Ejecutar todas las pruebas backend/frontend. — 2026-11-09: 101/101 unit, 165/165 e2e; frontend lint + smoke 35/35.
- [x] 7.2 Ejecutar build/compilación de producción. — `nest build` y `next build` OK.
- [x] 7.3 Probar migraciones desde BD limpia. — global-setup e2e aplica migraciones sobre esquema vacío; revert/run verificado y sin drift.
- [x] 7.4 Mantener `.env.example` sin secretos. — solo placeholders; añadidas variables `PUBLIC_*`/`LEADS_*`.
- [ ] 7.5 Verificar HTTPS, CORS, cookies y URL pública en entorno acordado. — pendiente de entorno acordado (HTTPS, dominio, `trust proxy`).
- [x] 7.6 Revisar logs y datos sensibles. — nuevos módulos no registran datos; `MAIL_TRANSPORT=log` (escribe tokens) rechazado en producción.
- [x] 7.7 Documentar instalación, ejecución, migraciones, pruebas y limitaciones. — `README.md` (perfiles, endpoints, pruebas, limitaciones).
- [x] 7.8 Registrar backlog no entregado. — design.md «Backlog no entregado».
- [ ] 7.10 Archivar cambios OpenSpec completados.

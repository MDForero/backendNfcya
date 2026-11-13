# Design: decisiones técnicas y modelo de dominio

## Arquitectura
Mantener NestJS modular y Next.js como cliente web. Reutilizar módulos existentes (`auth`, `users`, `organizations`, `admin`, `audit`, `mail`). Añadir módulos solo donde haya responsabilidad diferenciada: `profiles`, `profile-links`, `nfc-qr`, `leads`. No crear módulos innecesarios.

## Modelo sugerido
Los nombres son conceptuales; contrastar con entidades reales antes de migrar.

### Profile
- `id` UUID; `ownerUserId`; `organizationId` nullable según tipo.
- `slug` único normalizado.
- `displayName`, `headline`, `bio`, `avatarUrl`, `coverUrl`.
- `phone`, `email`, `website`, `locationLabel` opcionales.
- `theme` validado contra opciones permitidas.
- `visibility`: `PRIVATE`, `UNLISTED`, `PUBLIC` si aplica.
- `status`: `DRAFT`, `PUBLISHED`, `SUSPENDED`.
- timestamps y `publishedAt`.

### ProfileLink
- `id`, `profileId`, `label`, `url`, `type`, `sortOrder`, `isActive`, timestamps.
- Tipos controlados: `WEBSITE`, `INSTAGRAM`, `FACEBOOK`, `LINKEDIN`, `WHATSAPP`, `YOUTUBE`, `TIKTOK`, `OTHER`.

### ProfileIdentifier
- `id`, `profileId`, `kind` (`NFC`/`QR`), `publicCode` aleatorio opaco y único.
- `mode` (`STATIC`/`DYNAMIC`) solo si se implementa.
- `status` (`ACTIVE`/`INACTIVE`/`REVOKED`), timestamps y `revokedAt`.

### Lead (P1)
- `id`, `profileId`, `name`, `email`, `phone`, `message`.
- `consentAccepted`, `source`, `createdAt`.
- Política de retención y acceso restringido obligatorios.

## Slug y publicación
- Minúsculas, sin espacios, caracteres seguros; unicidad garantizada en BD.
- No codificar dominio productivo hasta confirmación empresarial.
- Perfiles en borrador, privados o suspendidos no son públicos.
- Respuesta pública mediante DTO explícito; no serializar entidad TypeORM.

## Seguridad y privacidad
- Validar DTOs, longitudes, tipos y URLs.
- Bloquear esquemas `javascript:`, `data:` y similares; permitir solo protocolos aprobados.
- Limitar número de enlaces, tamaño de biografía y peticiones públicas.
- Evitar XSS; no renderizar HTML arbitrario.
- Tokens públicos no secuenciales, aleatorios y con entropía suficiente.
- Aplicar rate limit a resolución de códigos y captura de leads.
- No registrar tokens, contraseñas ni datos sensibles.
- Consentimiento explícito antes de almacenar datos personales.
- Verificar propiedad de recurso en cada operación de escritura (evitar IDOR).

## Contratos API orientativos
Estos paths son propuestas, no rutas confirmadas. Inspeccionar prefijo global, versionado y convenciones existentes.

| Método | Ruta sugerida | Función | Acceso |
|---|---|---|---|
| GET | `/profiles/me` | Obtener perfil propio | Autenticado |
| POST | `/profiles` | Crear perfil | Autenticado |
| PATCH | `/profiles/me` | Actualizar perfil | Autenticado |
| GET | `/profiles/slug-availability?slug=` | Disponibilidad slug | Autenticado |
| GET | `/profiles/public/:slug` | Consultar perfil público | Público |
| POST | `/profiles/me/links` | Crear enlace | Autenticado |
| PATCH | `/profiles/me/links/:id` | Editar enlace | Autenticado |
| DELETE | `/profiles/me/links/:id` | Eliminar enlace | Autenticado |
| PATCH | `/profiles/me/links/reorder` | Reordenar | Autenticado |
| POST | `/profiles/me/publish` | Publicar | Autenticado |
| POST | `/profiles/me/unpublish` | Despublicar | Autenticado |
| POST | `/profiles/me/identifiers` | Crear NFC/QR | Autenticado |
| GET | `/profiles/me/identifiers` | Listar NFC/QR | Autenticado |
| PATCH | `/profiles/me/identifiers/:id/status` | Cambiar estado | Autenticado |
| GET | `/resolve/:code` | Resolver identificador | Público |
| GET | `/profiles/public/:slug/vcard` | Descargar vCard | Público |
| POST | `/profiles/public/:slug/leads` | Crear lead | Público + rate limit |
| GET | `/admin/profiles` | Listar perfiles | Admin |

## NFC y QR
Flujo mínimo: crear código opaco → formar URL HTTPS → grabar URL en chip/imprimir QR → visitante abre URL → se resuelve perfil. Revocar/desactivar impide nuevas resoluciones. No es obligatorio escribir físicamente el chip desde backend. QR estático basta para primera entrega; QR dinámico queda posterior si el tiempo no alcanza.

## vCard
Generar `.vcf` a partir de campos públicos, escapar caracteres especiales y saltos de línea, configurar MIME y nombre de archivo, probar acentos y caracteres especiales.

## Pruebas
Unitarias para servicios/validadores/slug/vCard; E2E para CRUD/publicación/consulta/roles/revocación; casos de acceso cruzado; frontend para estados, errores y navegación; pruebas reales en móvil para URL, QR y vCard.

## Priorización por fecha
El periodo de prácticas termina el 27 de noviembre de 2026. Al 9 de noviembre queda un periodo corto. Orden recomendado:
- P0: estabilizar autenticación/integración; perfil propio; enlaces; perfil público; resolución básica NFC/QR.
- P1: vCard; panel administrativo mínimo; captura básica de leads con consentimiento.
- P2/fase posterior: QR dinámico avanzado, analítica, membresías, pagos Wompi, Google Contacts, DIAN, app móvil.

No sacrificar seguridad ni pruebas para aumentar el porcentaje de tareas.

## Reglas de arquitectura y negocio
- Mantener monolito modular NestJS.
- Backend es autoridad para autenticación, autorización y propiedad de recursos.
- `CLIENTE` administra solo su perfil; `EMPRESA` solo recursos de su organización según reglas aprobadas; `SOPORTE` y `SUPER_ADMIN` conservan las policies actuales.
- No confiar en `ownerUserId` ni `organizationId` enviados por el cliente: derivarlos del usuario autenticado y validar permisos.
- Perfiles públicos devuelven DTO de lista permitida, nunca entidades completas.
- El chip NFC almacena solo una URL HTTPS, no datos personales.
- No incluir secretos ni datos personales en logs.

## Decisiones de diseño (propuestas 2026-11-09; confirmadas por el supervisor 2026-11-09 — tarea 0.5)
Confirmadas expresamente: **un perfil por usuario**, **dominio público configurable** (`PUBLIC_BASE_URL`) e **imágenes como URLs externas**. El resto se implementó así y no recibió objeciones.

- ✅ **Un perfil por usuario** (`UQ_profiles_owner`), solo roles `CLIENTE` y `EMPRESA`. `SOPORTE`/`SUPER_ADMIN` administran, no tienen perfil.
- **Organización**: no se guarda en `profiles`; se toma del propietario (join) para que no se desincronice si cambia de organización. `EMPRESA` ve y suspende perfiles de los `CLIENTE` de su organización (misma policy que `/admin/users`).
- **Rutas `/profiles/me/*`** sin ID de perfil: se deriva del usuario autenticado. Recursos ajenos (enlaces, códigos, leads) responden 404.
- **Visibilidad**: sin `visibility` PRIVATE/UNLISTED/PUBLIC; basta `status` (`DRAFT`/`PUBLISHED`/`SUSPENDED`). Email y teléfono son privados por defecto (`showEmail`/`showPhone`), también en la vCard. Un perfil cuya cuenta está suspendida deja de ser público.
- **Suspensión**: bloquea publicar/despublicar al propietario; reactivar deja el perfil en `DRAFT`. Se audita en `audit_logs` (`PROFILE_SUSPENDED`/`PROFILE_REACTIVATED`, `targetUserId` = propietario, `before`/`after` con `profileId`).
- ✅ **Dominio público**: `PUBLIC_BASE_URL` (vacío = `FRONTEND_URL`). Perfil en `/p/:slug`, NFC/QR en `/r/:code` (el frontend llama `GET /resolve/:code`).
- ✅ **Imágenes**: `avatarUrl`/`coverUrl` como URLs `https` externas; el almacenamiento propio queda en backlog 8.6.
- **Códigos NFC/QR**: 96 bits aleatorios (16 caracteres base64url), QR estático. `INACTIVE` es reversible, `REVOKED` definitivo. Máx. 10 sin revocar por perfil; máx. 20 enlaces.
- **Leads**: desactivados por defecto (`leadsEnabled`); requieren `consentAccepted: true` y email o teléfono; texto de finalidad en `GET /profiles/public/leads/consent`. Acceso: propietario y `SUPER_ADMIN`. Retención: el propietario puede borrar; política formal pendiente.
- **Borrado e integridad** (2026-11-11): borrar un usuario elimina en cascada su perfil, enlaces, códigos NFC/QR, leads, tokens e identidades; una organización con usuarios no se puede borrar (`RESTRICT`). `audit_logs.actor_id`/`target_user_id` **no tienen FK** a propósito: la auditoría se conserva aunque el usuario se borre (los registros pueden quedar apuntando a un id inexistente). `login_attempts` tampoco (registra emails que pueden no existir). Desde 2026-11-12 un `SUPER_ADMIN` puede eliminar usuarios (`DELETE /admin/users/:id`, auditado como `USER_DELETED` con email/nombre/rol en `before`; no a sí mismo ni al último `SUPER_ADMIN` activo); suspender sigue siendo la opción normal. Los perfiles no se eliminan por separado (se suspenden).
- **Alta de administradores** (2026-11-12): `POST /admin/users` (solo `SUPER_ADMIN`) crea `SUPER_ADMIN` o `SOPORTE` sin contraseña y envía una invitación (token `RESET_PASSWORD` con vigencia de 72 h); al definir la clave el correo queda verificado. Auditado como `USER_CREATED`. El resto de roles se obtiene registrándose y cambiando el rol.
- **Rate limit**: `PUBLIC_THROTTLE_LIMIT` (60/min) en perfil público, vCard y `/resolve`; `LEADS_THROTTLE_LIMIT` (5/min) en leads.

## Backlog no entregado (2026-11-09)
Además del backlog posterior a las prácticas (8.1–8.8 del proposal):
- Pruebas con teléfono real: escaneo NFC/QR e importación de la vCard en iOS/Android (frontend 4.14, 5.4).
- Pruebas manuales restantes de autenticación: registro por UI, refresh inválido, logout-all, recuperación y cambio de contraseña (frontend 1.15).
- Google OAuth con credenciales reales (backend 1.2).
- Despliegue con HTTPS, dominio público definitivo y `trust proxy` para el rate limit (7.5).
- Vista previa OG/SEO del perfil público (requiere resolver rate limit por IP en SSR).
- Subida/almacenamiento propio de imágenes (8.6); hoy URLs `https` externas.
- Política formal de retención de leads (hoy el propietario puede borrarlos).
- Store compartido (Redis) para el rate limit si hay varias instancias.

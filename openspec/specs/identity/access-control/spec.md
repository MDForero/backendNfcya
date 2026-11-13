# identity/access-control Specification

## Purpose
Define qué puede hacer cada usuario autenticado de nfcYA según su rol y su organización, y cómo se administran los roles y el estado de las cuentas.

## Requirements

### Requirement: Catálogo de roles
Todo usuario SHALL tener exactamente un rol de este conjunto: `SUPER_ADMIN`, `SOPORTE`, `EMPRESA`, `CLIENTE`. El visitante que consulta contenido público no tiene cuenta ni rol y solo puede acceder a rutas marcadas como públicas.

#### Scenario: Rol desconocido
- **WHEN** se intenta asignar a un usuario un rol fuera del catálogo
- **THEN** el sistema rechaza la operación con un error de validación

#### Scenario: Visitante en ruta protegida
- **WHEN** un visitante sin sesión llama a una ruta no pública
- **THEN** el sistema responde 401

### Requirement: Autorización por rol
Cada ruta protegida SHALL declarar qué roles pueden usarla. Un usuario autenticado cuyo rol no esté permitido MUST recibir 403. Las rutas sin declaración de roles MUST quedar accesibles a cualquier usuario autenticado, y solo las marcadas explícitamente como públicas MUST aceptar peticiones sin sesión.

#### Scenario: Rol permitido
- **WHEN** un `SUPER_ADMIN` llama a una ruta restringida a `SUPER_ADMIN`
- **THEN** el sistema procesa la petición

#### Scenario: Rol no permitido
- **WHEN** un `CLIENTE` llama a una ruta restringida a `SUPER_ADMIN` o `SOPORTE`
- **THEN** el sistema responde 403

### Requirement: Rol y estado vigentes en cada petición
La autorización SHALL basarse en el rol y estado actuales del usuario, no en los que tenía al emitirse el token. Un usuario suspendido MUST recibir 401 en cualquier ruta protegida aunque su access token no haya expirado.

#### Scenario: Rol cambiado con token vigente
- **WHEN** a un `EMPRESA` se le cambia el rol a `CLIENTE` y luego usa un access token emitido antes del cambio en una ruta solo para `EMPRESA`
- **THEN** el sistema responde 403

#### Scenario: Suspensión con token vigente
- **WHEN** un usuario suspendido usa un access token aún no expirado
- **THEN** el sistema responde 401

### Requirement: Permisos de SUPER_ADMIN
Un `SUPER_ADMIN` SHALL poder listar y consultar todos los usuarios, cambiar el rol de cualquier usuario, asignar o quitar la organización de un usuario, suspender y reactivar cuentas, y crear, listar y editar organizaciones.

#### Scenario: Gestión global de usuarios
- **WHEN** un `SUPER_ADMIN` lista usuarios
- **THEN** el sistema devuelve usuarios de todas las organizaciones y sin organización, con paginación y filtros por rol, estado y organización

#### Scenario: Crear organización
- **WHEN** un `SUPER_ADMIN` crea una organización con un nombre
- **THEN** el sistema la crea y queda disponible para asignar usuarios

### Requirement: Permisos de SOPORTE
Un `SOPORTE` SHALL poder listar y consultar todos los usuarios y organizaciones, reenviar el correo de verificación y enviar el correo de recuperación de contraseña a un usuario. MUST NOT poder cambiar roles, cambiar organizaciones, suspender, reactivar ni eliminar cuentas.

#### Scenario: Consulta de soporte
- **WHEN** un `SOPORTE` consulta un usuario
- **THEN** el sistema devuelve sus datos sin información secreta

#### Scenario: Acción de asistencia
- **WHEN** un `SOPORTE` solicita reenviar la verificación o enviar recuperación de contraseña a un usuario
- **THEN** el sistema envía el correo correspondiente a ese usuario

#### Scenario: Acción fuera de su alcance
- **WHEN** un `SOPORTE` intenta cambiar un rol o suspender una cuenta
- **THEN** el sistema responde 403 sin modificar nada

### Requirement: Permisos de EMPRESA acotados a su organización
Un `EMPRESA` SHALL pertenecer a una organización y solo poder listar, consultar, suspender y reactivar usuarios `CLIENTE` de su misma organización. MUST NOT poder cambiar roles ni organizaciones ni actuar sobre usuarios de otras organizaciones o con rol distinto de `CLIENTE`.

#### Scenario: Listar miembros
- **WHEN** un `EMPRESA` lista usuarios
- **THEN** el sistema devuelve únicamente los usuarios `CLIENTE` de su organización

#### Scenario: Usuario de otra organización
- **WHEN** un `EMPRESA` intenta consultar o suspender un usuario de otra organización
- **THEN** el sistema responde 404, sin revelar que el usuario existe

#### Scenario: Suspender miembro
- **WHEN** un `EMPRESA` suspende a un `CLIENTE` de su organización
- **THEN** la cuenta queda suspendida y sus sesiones revocadas

### Requirement: Permisos de CLIENTE
Un `CLIENTE` SHALL poder consultar y actualizar únicamente su propia cuenta (nombre y contraseña). MUST NOT acceder a datos de otros usuarios ni a rutas administrativas.

#### Scenario: Acceso a cuenta propia
- **WHEN** un `CLIENTE` actualiza su nombre
- **THEN** el sistema guarda el cambio

#### Scenario: Acceso administrativo
- **WHEN** un `CLIENTE` llama a una ruta de administración de usuarios
- **THEN** el sistema responde 403

### Requirement: Cambio de rol
Solo un `SUPER_ADMIN` SHALL cambiar roles. Asignar `EMPRESA` MUST requerir que el usuario tenga organización. Un `SUPER_ADMIN` MUST NOT cambiar su propio rol, y el sistema MUST impedir dejar la plataforma sin ningún `SUPER_ADMIN` activo.

#### Scenario: Asignar EMPRESA sin organización
- **WHEN** se asigna `EMPRESA` a un usuario sin organización
- **THEN** el sistema rechaza el cambio indicando que falta la organización

#### Scenario: Auto-degradación
- **WHEN** un `SUPER_ADMIN` intenta cambiar su propio rol
- **THEN** el sistema rechaza el cambio

#### Scenario: Último SUPER_ADMIN
- **WHEN** un cambio de rol o suspensión dejaría cero `SUPER_ADMIN` activos
- **THEN** el sistema rechaza la operación

### Requirement: Suspensión y reactivación de cuentas
Una cuenta SHALL estar en estado `ACTIVA` o `SUSPENDIDA`. Al suspenderla, el sistema MUST revocar todas sus sesiones. Al reactivarla, el usuario MUST poder iniciar sesión de nuevo. Un usuario MUST NOT poder suspenderse a sí mismo.

#### Scenario: Suspensión
- **WHEN** un usuario autorizado suspende una cuenta
- **THEN** la cuenta pasa a `SUSPENDIDA` y todos sus refresh tokens quedan revocados

#### Scenario: Reactivación
- **WHEN** un usuario autorizado reactiva una cuenta suspendida
- **THEN** la cuenta pasa a `ACTIVA` y su dueño puede volver a iniciar sesión

#### Scenario: Auto-suspensión
- **WHEN** un usuario intenta suspender su propia cuenta
- **THEN** el sistema rechaza la operación

### Requirement: Registro de auditoría de acciones administrativas
El sistema SHALL registrar cada cambio de rol, cambio de organización, suspensión y reactivación con quién la hizo, sobre quién, qué cambió y cuándo.

#### Scenario: Cambio auditado
- **WHEN** un `SUPER_ADMIN` cambia el rol de un usuario
- **THEN** queda un registro con el actor, el usuario afectado, el rol anterior, el nuevo y la fecha

### Requirement: Bootstrap del primer SUPER_ADMIN
El sistema SHALL poder crear el primer `SUPER_ADMIN` a partir de configuración del entorno (email y contraseña) cuando no existe ningún `SUPER_ADMIN`. Si ya existe alguno, el bootstrap MUST NOT crear ni modificar cuentas.

#### Scenario: Plataforma sin administrador
- **WHEN** se ejecuta el bootstrap con email y contraseña configurados y no hay ningún `SUPER_ADMIN`
- **THEN** el sistema crea esa cuenta con rol `SUPER_ADMIN`, activa y con email verificado

#### Scenario: Administrador ya existente
- **WHEN** se ejecuta el bootstrap y ya existe un `SUPER_ADMIN`
- **THEN** el sistema no realiza cambios

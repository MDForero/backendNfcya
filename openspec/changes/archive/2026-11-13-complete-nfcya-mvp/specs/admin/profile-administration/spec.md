# Spec Delta

## Purpose

Administración mínima de perfiles y usuarios por roles autorizados.

## ADDED Requirements

### Requirement: Listado
Roles autorizados MUST consultar perfiles/usuarios dentro de su ámbito, con filtros y paginación.

#### Scenario: Cliente sin permisos
- **GIVEN** rol CLIENTE
- **WHEN** consulta endpoint administrativo
- **THEN** responde 403

### Requirement: Auditoría
Cambios administrativos de estado MUST registrar actor, acción, recurso y fecha.

#### Scenario: Cambio de estado auditado
- **GIVEN** un rol administrativo autorizado
- **WHEN** cambia el estado de un recurso
- **THEN** queda registrado el actor, la acción, el recurso y la fecha

### Requirement: Alta de administradores
Solo `SUPER_ADMIN` MUST poder crear cuentas `SUPER_ADMIN` o `SOPORTE`. La cuenta MUST nacer sin contraseña y el invitado MUST definirla con un enlace de un solo uso enviado a su correo (vigencia 72 h); quien la crea nunca conoce la clave.

#### Scenario: Invitación de un administrador
- **GIVEN** un `SUPER_ADMIN` autenticado
- **WHEN** crea una cuenta `SUPER_ADMIN` o `SOPORTE` con nombre y email
- **THEN** la cuenta queda activa sin contraseña, se envía la invitación, se audita `USER_CREATED` y, al definir la clave con el enlace, el correo queda verificado y puede iniciar sesión

#### Scenario: Rol no autorizado o email existente
- **GIVEN** un `SOPORTE`, `EMPRESA` o `CLIENTE`, o un email ya registrado
- **WHEN** intenta crear un administrador
- **THEN** responde 403 (rol) o 409 (email) y no se crea nada; roles distintos de `SUPER_ADMIN`/`SOPORTE` responden 400

### Requirement: Eliminación de usuarios
Solo `SUPER_ADMIN` MUST poder eliminar definitivamente un usuario. La eliminación MUST borrar en cascada su perfil, enlaces, códigos NFC/QR, leads, tokens e identidades, y MUST auditarse con los datos del usuario borrado. Suspender sigue siendo la acción habitual; los perfiles no se eliminan por separado.

#### Scenario: Eliminación auditada
- **GIVEN** un `SUPER_ADMIN` y otro usuario
- **WHEN** lo elimina
- **THEN** el usuario y sus datos dependientes desaparecen, su sesión deja de funcionar de inmediato y queda `USER_DELETED` con email, nombre y rol en la auditoría

#### Scenario: Protecciones
- **GIVEN** un `SUPER_ADMIN`
- **WHEN** intenta eliminarse a sí mismo o eliminar al último `SUPER_ADMIN` activo
- **THEN** responde 400 o 409 y no borra nada

### Requirement: Conservación de la auditoría
La auditoría MUST conservarse aunque se elimine el actor o el afectado (sin clave foránea a `users`).

#### Scenario: Auditoría tras un borrado
- **GIVEN** registros de auditoría de un usuario
- **WHEN** el usuario se elimina
- **THEN** los registros permanecen

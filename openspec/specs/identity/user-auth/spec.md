# identity/user-auth Specification

## Purpose
Permite que las personas creen una cuenta en nfcYA, prueben su identidad (con email y contraseña o con Google) y mantengan una sesión segura para gestionar su información.

## Requirements

### Requirement: Registro con email y contraseña
El sistema SHALL permitir crear una cuenta con nombre, email y contraseña. El email MUST tratarse sin distinguir mayúsculas y ser único. La contraseña MUST tener al menos 8 caracteres e incluir letras y números. Toda cuenta nueva creada por registro público MUST recibir el rol `CLIENTE` y quedar en estado pendiente de verificación.

#### Scenario: Registro exitoso
- **WHEN** un visitante envía nombre, un email no registrado y una contraseña válida
- **THEN** el sistema crea la cuenta con rol `CLIENTE` y email no verificado, envía un correo de verificación y responde con éxito sin emitir tokens de sesión

#### Scenario: Contraseña débil
- **WHEN** un visitante envía una contraseña de menos de 8 caracteres o sin letras y números
- **THEN** el sistema rechaza la solicitud con un error de validación que indica la regla incumplida y no crea la cuenta

#### Scenario: Email ya registrado
- **WHEN** un visitante se registra con un email que ya existe (con cualquier combinación de mayúsculas)
- **THEN** el sistema responde igual que en un registro exitoso, no crea una segunda cuenta y envía al dueño del email un aviso de intento de registro

#### Scenario: Rol solicitado por el cliente
- **WHEN** la solicitud de registro incluye un campo de rol u organización
- **THEN** el sistema ignora esos campos y asigna `CLIENTE` sin organización

### Requirement: Verificación de email
El sistema SHALL verificar el email mediante un enlace de un solo uso que expira a las 24 horas. Una cuenta con email no verificado MUST NOT poder iniciar sesión con contraseña. El sistema SHALL permitir reenviar el correo de verificación.

#### Scenario: Enlace válido
- **WHEN** el usuario abre un enlace de verificación vigente y no usado
- **THEN** el sistema marca el email como verificado e invalida el enlace

#### Scenario: Enlace expirado o reutilizado
- **WHEN** el usuario abre un enlace expirado o ya usado
- **THEN** el sistema rechaza la verificación y ofrece reenviar un nuevo enlace

#### Scenario: Reenvío de verificación
- **WHEN** se solicita reenviar la verificación para un email
- **THEN** el sistema responde siempre con el mismo mensaje genérico y, solo si la cuenta existe y no está verificada, envía un nuevo enlace e invalida los anteriores

### Requirement: Inicio de sesión con email y contraseña
El sistema SHALL autenticar a un usuario con email y contraseña correctos, email verificado y cuenta activa, y emitir una sesión. Ante credenciales inválidas MUST responder con un mensaje genérico que no revele si el email existe.

#### Scenario: Credenciales correctas
- **WHEN** un usuario activo y verificado envía su email y contraseña correctos
- **THEN** el sistema responde con un access token, un refresh token y los datos básicos del usuario (id, nombre, email, rol, organización)

#### Scenario: Credenciales incorrectas
- **WHEN** el email no existe o la contraseña no coincide
- **THEN** el sistema responde 401 con el mismo mensaje genérico en ambos casos

#### Scenario: Email sin verificar
- **WHEN** las credenciales son correctas pero el email no está verificado
- **THEN** el sistema rechaza el inicio de sesión indicando que el email debe verificarse

#### Scenario: Cuenta suspendida
- **WHEN** las credenciales son correctas pero la cuenta está suspendida
- **THEN** el sistema rechaza el inicio de sesión indicando que la cuenta está suspendida

### Requirement: Límite de intentos de inicio de sesión
El sistema SHALL limitar los intentos fallidos de inicio de sesión: tras 5 intentos fallidos para un mismo email en 15 minutos MUST bloquear temporalmente nuevos intentos para ese email durante 15 minutos.

#### Scenario: Exceso de intentos
- **WHEN** se registran 5 intentos fallidos para un email dentro de 15 minutos
- **THEN** el siguiente intento, aun con la contraseña correcta, se rechaza con 429 hasta que pase el periodo de bloqueo

### Requirement: Inicio de sesión con Google
El sistema SHALL permitir iniciar sesión con una cuenta de Google cuyo email esté verificado por Google. Si no existe una cuenta con ese email, MUST crearla con rol `CLIENTE` y email verificado. Si existe, MUST vincular la identidad de Google a esa cuenta.

#### Scenario: Primer acceso con Google
- **WHEN** un visitante completa el flujo de Google con un email verificado que no existe en nfcYA
- **THEN** el sistema crea la cuenta con rol `CLIENTE`, email verificado y sin contraseña, y emite una sesión

#### Scenario: Vinculación con cuenta existente
- **WHEN** un usuario completa el flujo de Google con un email que ya tiene cuenta en nfcYA
- **THEN** el sistema vincula la identidad de Google a esa cuenta, conserva su rol y organización, marca el email como verificado y emite una sesión

#### Scenario: Email de Google no verificado
- **WHEN** Google devuelve un email marcado como no verificado
- **THEN** el sistema rechaza el inicio de sesión y no crea ni vincula ninguna cuenta

#### Scenario: Cuenta suspendida vía Google
- **WHEN** el flujo de Google corresponde a una cuenta suspendida
- **THEN** el sistema rechaza el inicio de sesión indicando que la cuenta está suspendida

#### Scenario: Flujo cancelado o manipulado
- **WHEN** el usuario cancela en Google o el parámetro de estado del flujo no coincide
- **THEN** el sistema no emite sesión y redirige al frontend con un código de error

### Requirement: Sesión con access token y refresh token
Una sesión SHALL consistir en un access token de 15 minutos de vigencia y un refresh token de 30 días. Las rutas protegidas MUST rechazar con 401 peticiones sin access token válido. El access token MUST identificar al usuario y su rol.

#### Scenario: Acceso a ruta protegida
- **WHEN** se llama a una ruta protegida con un access token vigente
- **THEN** el sistema procesa la petición en nombre del usuario del token

#### Scenario: Token ausente, inválido o expirado
- **WHEN** se llama a una ruta protegida sin token, con un token alterado o expirado
- **THEN** el sistema responde 401

### Requirement: Renovación y rotación del refresh token
El sistema SHALL emitir un nuevo par de tokens al presentar un refresh token vigente e invalidar el usado. Si se presenta un refresh token ya rotado, MUST considerarlo robado y revocar todas las sesiones de ese usuario.

#### Scenario: Renovación válida
- **WHEN** el cliente presenta un refresh token vigente y no usado
- **THEN** el sistema responde con un nuevo access token y un nuevo refresh token, e invalida el anterior

#### Scenario: Reutilización de refresh token
- **WHEN** el cliente presenta un refresh token que ya fue rotado
- **THEN** el sistema responde 401 y revoca todas las sesiones activas del usuario

#### Scenario: Usuario suspendido al renovar
- **WHEN** se presenta un refresh token vigente de una cuenta suspendida
- **THEN** el sistema responde 401 y no emite tokens

### Requirement: Cierre de sesión
El sistema SHALL permitir cerrar la sesión actual (revocando su refresh token) y cerrar todas las sesiones del usuario.

#### Scenario: Cerrar sesión actual
- **WHEN** un usuario autenticado cierra sesión presentando su refresh token
- **THEN** ese refresh token deja de servir para renovar

#### Scenario: Cerrar todas las sesiones
- **WHEN** un usuario autenticado solicita cerrar todas sus sesiones
- **THEN** todos sus refresh tokens quedan revocados

### Requirement: Recuperación de contraseña
El sistema SHALL permitir restablecer la contraseña mediante un enlace de un solo uso enviado por correo, con vigencia de 1 hora. La solicitud MUST responder igual exista o no el email. Al restablecer, MUST revocar todas las sesiones del usuario.

#### Scenario: Solicitud de recuperación
- **WHEN** se solicita recuperar la contraseña para un email
- **THEN** el sistema responde con un mensaje genérico y, solo si la cuenta existe, envía el enlace

#### Scenario: Restablecimiento exitoso
- **WHEN** el usuario envía una nueva contraseña válida con un enlace vigente y no usado
- **THEN** el sistema actualiza la contraseña, invalida el enlace y revoca todas las sesiones existentes

#### Scenario: Enlace inválido
- **WHEN** el enlace está expirado, ya fue usado o no existe
- **THEN** el sistema rechaza el restablecimiento sin cambiar la contraseña

#### Scenario: Cuenta creada solo con Google
- **WHEN** un usuario que entró solo con Google restablece la contraseña con un enlace válido
- **THEN** la cuenta queda con contraseña y puede iniciar sesión por ambos métodos

### Requirement: Cambio de contraseña autenticado
El sistema SHALL permitir a un usuario autenticado cambiar su contraseña indicando la actual. Al cambiarla MUST revocar las demás sesiones del usuario.

#### Scenario: Cambio exitoso
- **WHEN** el usuario envía su contraseña actual correcta y una nueva válida
- **THEN** el sistema actualiza la contraseña y revoca las demás sesiones, manteniendo la actual

#### Scenario: Contraseña actual incorrecta
- **WHEN** la contraseña actual no coincide
- **THEN** el sistema rechaza el cambio sin modificar nada

### Requirement: Consulta del usuario autenticado
El sistema SHALL exponer los datos del usuario autenticado: id, nombre, email, estado de verificación, rol, organización (si tiene) y métodos de acceso vinculados. Nunca MUST incluir el hash de contraseña ni tokens.

#### Scenario: Consulta de perfil propio
- **WHEN** un usuario autenticado consulta sus datos
- **THEN** el sistema responde con los campos indicados y sin datos secretos

### Requirement: Protección de credenciales
Las contraseñas MUST almacenarse solo como hash con un algoritmo de derivación lento y sal por usuario. Los refresh tokens y los tokens de verificación y recuperación MUST almacenarse solo como hash.

#### Scenario: Inspección de la base de datos
- **WHEN** se inspeccionan los datos persistidos de usuarios y tokens
- **THEN** no aparece ninguna contraseña ni token en texto plano

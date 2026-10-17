# Proposal

## Why

nfcYA permite que un cliente comparta todos sus links de interés (redes sociales, vCard, portafolio, ubicación, etc.) con un solo escaneo de su chip NFC o código QR. Antes de construir la gestión de perfiles y links necesitamos saber **quién** es cada usuario y **qué puede hacer**: hoy el backend NestJS es solo el esqueleto generado y no tiene usuarios, sesiones ni permisos. Este cambio sienta esa base para que todos los módulos posteriores (perfiles, links, chips, analítica) se apoyen en una identidad y un control de acceso comunes.

## What Changes

- Registro de cuentas con email y contraseña, con verificación de correo obligatoria antes de poder iniciar sesión.
- Inicio de sesión con email y contraseña y con Google (OAuth 2.0 / OpenID Connect), vinculando la cuenta de Google a una cuenta existente cuando el email coincide y está verificado.
- Emisión de sesión mediante access token (JWT de corta duración) y refresh token rotativo y revocable; cierre de sesión y cierre de todas las sesiones.
- Recuperación de contraseña por correo y cambio de contraseña autenticado.
- Endpoint para consultar el usuario autenticado (`/auth/me`) con su rol y organización.
- Definición de cuatro roles de usuario autenticado:
  - `SUPER_ADMIN`: administra la plataforma completa (usuarios, organizaciones, roles).
  - `SOPORTE`: consulta cuentas y ayuda a usuarios; no puede eliminar cuentas, cambiar roles ni ver datos de facturación.
  - `EMPRESA`: administra una organización y los usuarios cliente que pertenecen a ella.
  - `CLIENTE`: gestiona únicamente su propia cuenta (y, en módulos futuros, su perfil y links).
- El **visitante público** que escanea un chip o QR no es un rol: no inicia sesión y solo accederá a rutas públicas.
- Mecanismo de autorización por rol y por pertenencia a organización (guards/decoradores reutilizables) y endpoints administrativos mínimos: listar usuarios, cambiar rol, suspender/reactivar cuenta.
- Bootstrap del primer `SUPER_ADMIN` mediante variables de entorno / seed.
- Protección básica: hash de contraseñas, límite de intentos de login, respuestas que no revelan si un email existe.

**Fuera de alcance** (cambios posteriores): perfiles públicos y gestión de links, alta y asignación de chips NFC / QR, invitaciones de empleados por correo, facturación y planes, 2FA, otros proveedores sociales (Apple, LinkedIn), pantallas del frontend Next.js.

## Capabilities

### New Capabilities
- `identity/user-auth`: registro, verificación de email, inicio de sesión con contraseña y con Google, ciclo de vida de tokens (emisión, renovación, revocación), recuperación y cambio de contraseña, y consulta del usuario autenticado.
- `identity/access-control`: catálogo de roles (`SUPER_ADMIN`, `SOPORTE`, `EMPRESA`, `CLIENTE`), sus permisos, el alcance por organización, la gestión administrativa de roles y estados de cuenta, y el bootstrap del primer administrador.

### Modified Capabilities
<!-- Ninguna: el proyecto aún no tiene specs. -->

## Impact

- **Código**: nuevos módulos NestJS en `backend/src` (`auth`, `users`, `organizations`, infraestructura de base de datos y correo); `app.module.ts` y `main.ts` pasan a registrar configuración, validación global y guards.
- **Dependencias nuevas**: `@nestjs/config`, `@nestjs/typeorm`, `typeorm`, `pg`, `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `passport-google-oauth20`, `argon2`, `class-validator`, `class-transformer`, `@nestjs/throttler`, y un cliente de correo (p. ej. `nodemailer`).
- **Infraestructura**: base de datos PostgreSQL con migraciones TypeORM; credenciales de Google OAuth (client id/secret, URL de callback); servidor SMTP o proveedor transaccional para los correos.
- **API**: nuevas rutas bajo `/auth/*` y `/admin/users/*`; el frontend Next.js las consumirá en un cambio posterior.

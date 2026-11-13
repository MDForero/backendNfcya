# profiles/profile-links Specification

## Purpose
Enlaces del perfil (redes, web, WhatsApp…) con validación, orden y visibilidad.

## Requirements

### Requirement: Crear enlace
El propietario MUST poder añadir enlaces con etiqueta, URL y tipo válidos.

#### Scenario: URL inválida
- **GIVEN** URL con esquema peligroso o formato inválido
- **WHEN** intenta guardarla
- **THEN** la API rechaza la solicitud

### Requirement: Modificar enlaces
El propietario MUST poder editar y eliminar solo enlaces de su perfil.

#### Scenario: Acceso ajeno
- **GIVEN** enlace de otro usuario
- **WHEN** usuario sin permiso intenta modificarlo
- **THEN** la API deniega la operación

### Requirement: Orden y visibilidad
El sistema MUST permitir ordenar y activar/desactivar enlaces.

#### Scenario: Enlace desactivado
- **GIVEN** enlace inactivo
- **WHEN** visitante consulta perfil público
- **THEN** el enlace no aparece

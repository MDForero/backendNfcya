# Spec Delta

## Purpose

Perfil digital de una persona o empresa, con slug público único y control de publicación.

## ADDED Requirements

### Requirement: Crear perfil propio
El sistema MUST permitir a un usuario autenticado autorizado crear un perfil asociado a su identidad y, cuando corresponda, a su organización.

#### Scenario: Creación válida
- **GIVEN** usuario autenticado sin perfil
- **WHEN** envía datos obligatorios válidos
- **THEN** se crea un perfil en estado borrador asociado al usuario autenticado

#### Scenario: Usuario no autenticado
- **GIVEN** solicitud sin sesión válida
- **WHEN** intenta crear perfil
- **THEN** responde 401 y no crea registros

### Requirement: Editar perfil
El propietario MUST poder actualizar solo los campos editables de su perfil.

#### Scenario: Acceso cruzado
- **GIVEN** usuario autenticado que no es propietario ni administrador autorizado
- **WHEN** intenta modificar perfil ajeno
- **THEN** se deniega la operación y no cambia la información

### Requirement: Slug único
El sistema MUST garantizar slug normalizado y único.

#### Scenario: Slug duplicado
- **GIVEN** que ya existe el slug normalizado
- **WHEN** se intenta asignar a otro perfil
- **THEN** responde conflicto y conserva el perfil existente

### Requirement: Publicación
Solo perfiles publicados y no suspendidos MUST ser visibles públicamente.

#### Scenario: Visitante consulta perfil publicado
- **GIVEN** perfil publicado
- **WHEN** visitante consulta su slug
- **THEN** recibe solo campos públicos y enlaces activos, sin IDs internos ni datos privados

#### Scenario: Perfil borrador
- **GIVEN** perfil en borrador/privado/suspendido
- **WHEN** visitante consulta su URL
- **THEN** no se revelan sus datos

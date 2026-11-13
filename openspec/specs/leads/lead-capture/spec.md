# leads/lead-capture Specification

## Purpose
Captura de leads con consentimiento explícito (P1).

## Requirements

### Requirement: Consentimiento
Si se activa captura de leads, el sistema MUST informar finalidad y requerir consentimiento explícito antes de almacenar datos personales.

#### Scenario: Consentimiento ausente
- **GIVEN** formulario de contacto
- **WHEN** visitante no acepta
- **THEN** no se almacena información

### Requirement: Acceso restringido
Solo propietario o rol administrativo autorizado MUST consultar leads.

#### Scenario: Consulta no autorizada
- **GIVEN** leads de un perfil
- **WHEN** un usuario que no es propietario ni rol administrativo autorizado intenta consultarlos
- **THEN** la API deniega la operación

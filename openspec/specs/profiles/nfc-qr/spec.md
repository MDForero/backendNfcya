# profiles/nfc-qr Specification

## Purpose
Identificadores NFC/QR opacos que resuelven a un perfil publicado.

## Requirements

### Requirement: Crear identificador
El sistema MUST crear identificadores NFC/QR opacos, aleatorios, únicos y asociados a un perfil autorizado.

#### Scenario: Creación
- **GIVEN** usuario con permiso sobre el perfil
- **WHEN** solicita identificador
- **THEN** recibe URL HTTPS de resolución

### Requirement: Resolver identificador
Solo códigos activos asociados a perfiles publicados MUST resolver.

#### Scenario: Código activo
- **GIVEN** código activo
- **WHEN** visitante abre URL
- **THEN** se muestra el perfil correspondiente

#### Scenario: Código revocado
- **GIVEN** código revocado o inexistente
- **WHEN** visitante abre URL
- **THEN** se muestra estado no disponible sin revelar información interna

### Requirement: Revocar
El propietario autorizado MUST poder desactivar o revocar el código y detener su resolución.

#### Scenario: Revocación por el propietario
- **GIVEN** código activo de un perfil propio
- **WHEN** el propietario lo desactiva o revoca
- **THEN** el código deja de resolver al perfil

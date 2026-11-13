export enum ProfileStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  SUSPENDED = 'SUSPENDED',
}

export enum ProfileTheme {
  DEFAULT = 'DEFAULT',
  DARK = 'DARK',
  OCEAN = 'OCEAN',
  SUNSET = 'SUNSET',
  FOREST = 'FOREST',
}

export enum LinkType {
  WEBSITE = 'WEBSITE',
  INSTAGRAM = 'INSTAGRAM',
  FACEBOOK = 'FACEBOOK',
  LINKEDIN = 'LINKEDIN',
  WHATSAPP = 'WHATSAPP',
  YOUTUBE = 'YOUTUBE',
  TIKTOK = 'TIKTOK',
  OTHER = 'OTHER',
}

export enum IdentifierKind {
  NFC = 'NFC',
  QR = 'QR',
}

/** INACTIVE es reversible; REVOKED es definitivo. */
export enum IdentifierStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  REVOKED = 'REVOKED',
}

/** Roles que pueden tener (y editar) un perfil digital propio. */
export const PROFILE_OWNER_ROLES = ['CLIENTE', 'EMPRESA'] as const;

export const MAX_LINKS_PER_PROFILE = 20;
export const MAX_IDENTIFIERS_PER_PROFILE = 10;

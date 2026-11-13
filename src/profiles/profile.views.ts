import { LinkType } from './profile.enums';
import { ProfileIdentifier } from './entities/profile-identifier.entity';
import { ProfileLink } from './entities/profile-link.entity';
import { Profile } from './entities/profile.entity';

/** Base de las URLs públicas (perfil y NFC/QR): PUBLIC_BASE_URL o, si no hay, FRONTEND_URL. */
export function publicBaseUrl() {
  const base = process.env.PUBLIC_BASE_URL || process.env.FRONTEND_URL || '';
  return base.replace(/\/$/, '');
}

export const profileUrl = (slug: string) => `${publicBaseUrl()}/p/${slug}`;
export const identifierUrl = (code: string) => `${publicBaseUrl()}/r/${code}`;

export function sortLinks(links: ProfileLink[] = []) {
  return [...links].sort((a, b) => a.sortOrder - b.sortOrder);
}

export interface LinkView {
  id: string;
  label: string;
  url: string;
  type: LinkType;
  sortOrder: number;
  isActive: boolean;
}

export function toLinkView(link: ProfileLink): LinkView {
  return {
    id: link.id,
    label: link.label,
    url: link.url,
    type: link.type,
    sortOrder: link.sortOrder,
    isActive: link.isActive,
  };
}

/** Vista para el propietario: todos sus datos, incluidos los no públicos. */
export function toOwnerView(profile: Profile) {
  return {
    id: profile.id,
    slug: profile.slug,
    publicUrl: profileUrl(profile.slug),
    displayName: profile.displayName,
    headline: profile.headline,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    coverUrl: profile.coverUrl,
    phone: profile.phone,
    email: profile.email,
    website: profile.website,
    locationLabel: profile.locationLabel,
    showEmail: profile.showEmail,
    showPhone: profile.showPhone,
    leadsEnabled: profile.leadsEnabled,
    theme: profile.theme,
    status: profile.status,
    publishedAt: profile.publishedAt,
    suspendedAt: profile.suspendedAt,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    links: sortLinks(profile.links).map(toLinkView),
  };
}
export type OwnerProfileView = ReturnType<typeof toOwnerView>;

/**
 * Vista pública: lista explícita de campos permitidos. Sin IDs internos, sin estado y
 * sin email/teléfono salvo autorización expresa del propietario.
 */
export function toPublicView(profile: Profile) {
  return {
    slug: profile.slug,
    displayName: profile.displayName,
    headline: profile.headline,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    coverUrl: profile.coverUrl,
    website: profile.website,
    locationLabel: profile.locationLabel,
    email: profile.showEmail ? profile.email : null,
    phone: profile.showPhone ? profile.phone : null,
    theme: profile.theme,
    leadsEnabled: profile.leadsEnabled,
    links: sortLinks(profile.links)
      .filter((link) => link.isActive)
      .map((link) => ({ label: link.label, url: link.url, type: link.type })),
  };
}
export type PublicProfileView = ReturnType<typeof toPublicView>;

export function toIdentifierView(identifier: ProfileIdentifier) {
  return {
    id: identifier.id,
    kind: identifier.kind,
    label: identifier.label,
    code: identifier.publicCode,
    url: identifierUrl(identifier.publicCode),
    status: identifier.status,
    revokedAt: identifier.revokedAt,
    createdAt: identifier.createdAt,
  };
}

export const SLUG_MIN = 3;
export const SLUG_MAX = 40;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Slugs que chocan con rutas del frontend/API o confunden a los visitantes. */
export const RESERVED_SLUGS = [
  'admin',
  'api',
  'app',
  'auth',
  'dashboard',
  'login',
  'logout',
  'register',
  'me',
  'new',
  'p',
  'r',
  'perfil',
  'perfiles',
  'profile',
  'profiles',
  'public',
  'resolve',
  'settings',
  'soporte',
  'support',
  'www',
  'nfcya',
];

/** "  Juan Pérez & Cía " → "juan-perez-cia": minúsculas, sin acentos, guiones simples. */
export function normalizeSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '');
}

/** Motivo por el que un slug ya normalizado no es válido, o null si lo es. */
export function slugProblem(slug: string): string | null {
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX)
    return `El slug debe tener entre ${SLUG_MIN} y ${SLUG_MAX} caracteres`;
  if (!SLUG_PATTERN.test(slug))
    return 'El slug solo admite letras minúsculas, números y guiones';
  if (RESERVED_SLUGS.includes(slug)) return 'Ese slug está reservado';
  return null;
}

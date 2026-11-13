import { ValidateBy, ValidationOptions } from 'class-validator';

export const MAX_URL_LENGTH = 2048;

const WEB_PROTOCOLS = ['http:', 'https:'];

function hasControlChars(value: string) {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

function parse(value: unknown): URL | null {
  if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) return null;
  // Sin espacios, caracteres de control ni comillas: evita trucos como "java\tscript:".
  if (/[\s<>"'`]/.test(value) || hasControlChars(value)) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isWebUrl(url: URL) {
  return (
    WEB_PROTOCOLS.includes(url.protocol) &&
    !url.username &&
    !url.password &&
    (url.hostname === 'localhost' || /\.[a-z]{2,}$/i.test(url.hostname))
  );
}

/**
 * URL permitida en un enlace del perfil: http(s), mailto: o tel:.
 * Cualquier otro esquema (javascript:, data:, file:, vbscript:…) se rechaza.
 */
export function isSafeLinkUrl(value: unknown): boolean {
  const url = parse(value);
  if (!url) return false;
  if (url.protocol === 'mailto:')
    return /^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/.test(url.pathname);
  if (url.protocol === 'tel:') return /^\+?[0-9().-]{3,30}$/.test(url.pathname);
  return isWebUrl(url);
}

/** URL web (http/https). Con httpsOnly, solo https (p. ej. imágenes, para evitar contenido mixto). */
export function isWebLink(value: unknown, httpsOnly = false): boolean {
  const url = parse(value);
  if (!url || !isWebUrl(url)) return false;
  return !httpsOnly || url.protocol === 'https:';
}

export const IsSafeLinkUrl = (options?: ValidationOptions) =>
  ValidateBy(
    {
      name: 'isSafeLinkUrl',
      validator: {
        validate: isSafeLinkUrl,
        defaultMessage: () =>
          '$property debe ser una URL http(s), mailto: o tel: válida',
      },
    },
    options,
  );

export const IsWebLink = (httpsOnly = false, options?: ValidationOptions) =>
  ValidateBy(
    {
      name: 'isWebLink',
      validator: {
        validate: (value) => isWebLink(value, httpsOnly),
        defaultMessage: () =>
          httpsOnly
            ? '$property debe ser una URL https válida'
            : '$property debe ser una URL http(s) válida',
      },
    },
    options,
  );

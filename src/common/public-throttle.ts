import { Throttle } from '@nestjs/throttler';

/**
 * Límites para rutas públicas (perfil, resolución NFC/QR, vCard, leads). Se leen de
 * process.env en cada petición para poder ajustarlos sin recompilar; ver .env.example.
 */
function envInt(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

const ttl = () => envInt('PUBLIC_THROTTLE_TTL_SECONDS', 60) * 1000;

/** Lecturas públicas: generoso, pero frena enumeración de slugs/códigos. */
export const PublicReadThrottle = () =>
  Throttle({
    default: { ttl, limit: () => envInt('PUBLIC_THROTTLE_LIMIT', 60) },
  });

/** Escrituras públicas (leads): estricto, para frenar spam. */
export const PublicWriteThrottle = () =>
  Throttle({
    default: { ttl, limit: () => envInt('LEADS_THROTTLE_LIMIT', 5) },
  });

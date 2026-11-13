import { Throttle } from '@nestjs/throttler';

function envInt(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/**
 * Límite propio para mantener la sesión (refresh/logout): más alto que el de login/registro,
 * porque cada carga de página renueva el token y una oficina comparte IP pública. Se lee de
 * process.env en cada petición, como los límites públicos (ver common/public-throttle.ts).
 */
export const SessionThrottle = () =>
  Throttle({
    default: {
      ttl: () => envInt('AUTH_THROTTLE_TTL_SECONDS', 60) * 1000,
      limit: () => envInt('AUTH_SESSION_THROTTLE_LIMIT', 300),
    },
  });

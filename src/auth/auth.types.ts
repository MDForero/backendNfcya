import type { Request } from 'express';
import type { Role } from '../users/role.enum';
import type { User } from '../users/user.entity';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user: User;
}

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export function requestMeta(req: Request): RequestMeta {
  return {
    ip: req.ip ?? null,
    userAgent: req.get('user-agent')?.slice(0, 512) ?? null,
  };
}

/** Códigos de error estables para que el frontend no dependa del texto del mensaje. */
export const AuthErrorCode = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS',
  INVALID_TOKEN: 'INVALID_TOKEN',
  INVALID_SESSION: 'INVALID_SESSION',
} as const;

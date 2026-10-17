import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import {
  EnvironmentVariables,
  isGoogleConfigured,
} from '../../config/env.validation';

export type GoogleRequest = Request & { oauthError?: string };

/**
 * Envuelve la estrategia de Google sin lanzar excepciones: cualquier fallo (Google no
 * configurado, usuario canceló, state manipulado) queda en `req.oauthError` para que el
 * controlador redirija al frontend con un código de error.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  private readonly enabled: boolean;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super();
    this.enabled = isGoogleConfigured({
      GOOGLE_CLIENT_ID: config.get('GOOGLE_CLIENT_ID', { infer: true }),
      GOOGLE_CLIENT_SECRET: config.get('GOOGLE_CLIENT_SECRET', { infer: true }),
      GOOGLE_CALLBACK_URL: config.get('GOOGLE_CALLBACK_URL', { infer: true }),
    });
  }

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<GoogleRequest>();
    if (!this.enabled) {
      req.oauthError = 'google_disabled';
      return true;
    }
    try {
      return (await super.canActivate(context)) as boolean;
    } catch {
      req.oauthError = 'oauth_failed';
      return true;
    }
  }

  handleRequest<T>(err: unknown, user: T): T {
    if (err instanceof Error) throw err;
    if (err || !user) throw new Error('oauth_failed');
    return user;
  }
}

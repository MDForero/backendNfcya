import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { MailService } from '../../mail/mail.service';
import { requestMeta } from '../auth.types';
import { Public } from '../decorators/public.decorator';
import { RefreshCookieService } from '../refresh-cookie.service';
import { SessionsService } from '../sessions.service';
import { GoogleAuthGuard } from './google-auth.guard';
import type { GoogleRequest } from './google-auth.guard';
import { GoogleAuthService } from './google-auth.service';
import { GoogleProfile } from './google.strategy';

/**
 * El callback nunca pone tokens en la URL: deja la cookie de refresh y redirige a
 * FRONTEND_URL/auth/callback, donde el frontend llama a POST /auth/refresh.
 */
@Public()
@Controller('auth/google')
@UseGuards(ThrottlerGuard)
export class GoogleAuthController {
  constructor(
    private readonly google: GoogleAuthService,
    private readonly sessions: SessionsService,
    private readonly cookie: RefreshCookieService,
    private readonly mail: MailService,
  ) {}

  @Get()
  @UseGuards(GoogleAuthGuard)
  start(@Req() req: GoogleRequest, @Res() res: Response) {
    // Solo se llega aquí si la estrategia no redirigió a Google (p. ej. deshabilitada).
    res.redirect(this.callbackUrl(req.oauthError ?? 'oauth_failed'));
  }

  @Get('callback')
  @UseGuards(GoogleAuthGuard)
  async callback(@Req() req: GoogleRequest, @Res() res: Response) {
    if (req.oauthError || !req.user) {
      return res.redirect(this.callbackUrl(req.oauthError ?? 'oauth_failed'));
    }

    const result = await this.google.resolve(req.user as GoogleProfile);
    if (!result.ok) return res.redirect(this.callbackUrl(result.error));

    const session = await this.sessions.start(result.user, requestMeta(req));
    this.cookie.set(res, session.refreshToken, session.refreshExpiresAt);
    return res.redirect(this.callbackUrl());
  }

  private callbackUrl(error?: string) {
    return this.mail.link('/auth/callback', error ? { error } : undefined);
  }
}

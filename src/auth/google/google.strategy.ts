import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, StrategyOptions } from 'passport-google-oauth20';
import { EnvironmentVariables } from '../../config/env.validation';
import { CookieStateStore } from './cookie-state.store';

export interface GoogleProfile {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string;
}

/** Solo se registra cuando las credenciales de Google están configuradas (ver AuthModule). */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super({
      clientID: config.get('GOOGLE_CLIENT_ID', { infer: true }),
      clientSecret: config.get('GOOGLE_CLIENT_SECRET', { infer: true }),
      callbackURL: config.get('GOOGLE_CALLBACK_URL', { infer: true })!,
      scope: ['openid', 'email', 'profile'],
      // passport-oauth2 elige la firma de store/verify por aridad; usamos (req, cb).
      store: new CookieStateStore(
        config.get('COOKIE_SECURE', { infer: true }),
      ) as unknown as StrategyOptions['store'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): GoogleProfile {
    return toGoogleProfile(profile);
  }
}

export function toGoogleProfile(profile: Profile): GoogleProfile {
  const json = profile._json as {
    email?: string;
    email_verified?: boolean | string;
  };
  const email = json.email ?? profile.emails?.[0]?.value ?? null;
  return {
    sub: profile.id,
    email,
    emailVerified:
      json.email_verified === true || json.email_verified === 'true',
    name: profile.displayName || email?.split('@')[0] || 'Usuario nfcYA',
  };
}

import { Injectable } from '@nestjs/common';
import { MailService } from '../../mail/mail.service';
import { UserStatus } from '../../users/role.enum';
import { User } from '../../users/user.entity';
import { UsersService } from '../../users/users.service';
import { GoogleProfile } from './google.strategy';

export type GoogleSignInResult =
  | { ok: true; user: User; created: boolean; linked: boolean }
  | { ok: false; error: 'email_not_verified' | 'account_suspended' };

/** Decide qué cuenta de nfcYA corresponde a un inicio de sesión con Google. */
@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly users: UsersService,
    private readonly mail: MailService,
  ) {}

  async resolve(profile: GoogleProfile): Promise<GoogleSignInResult> {
    const known = await this.users.findByIdentity('google', profile.sub);
    if (known) {
      if (known.status === UserStatus.SUSPENDIDA)
        return { ok: false, error: 'account_suspended' };
      return { ok: true, user: known, created: false, linked: false };
    }

    // Sin email verificado por Google no se crea ni se vincula nada.
    if (!profile.email || !profile.emailVerified)
      return { ok: false, error: 'email_not_verified' };

    const existing = await this.users.findByEmail(profile.email);
    if (existing) {
      if (existing.status === UserStatus.SUSPENDIDA)
        return { ok: false, error: 'account_suspended' };
      await this.users.linkIdentity(existing.id, 'google', profile.sub);
      await this.users.markEmailVerified(existing.id);
      await this.mail.sendProviderLinked(existing, 'Google');
      return { ok: true, user: existing, created: false, linked: true };
    }

    const user = await this.users.create({
      email: profile.email,
      name: profile.name,
      passwordHash: null,
      emailVerifiedAt: new Date(),
    });
    await this.users.linkIdentity(user.id, 'google', profile.sub);
    return { ok: true, user, created: true, linked: false };
  }
}

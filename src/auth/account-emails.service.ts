import { Injectable } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { User } from '../users/user.entity';
import { OneTimeTokenType } from './entities/one-time-token.entity';
import { OneTimeTokensService } from './one-time-tokens.service';

/** Vigencia del enlace de invitación de administradores (más que un reset normal). */
export const ADMIN_INVITATION_TTL_MS = 72 * 60 * 60 * 1000;

/** Correos de cuenta que llevan un token de un solo uso. Lo usan auth y administración. */
@Injectable()
export class AccountEmailsService {
  constructor(
    private readonly tokens: OneTimeTokensService,
    private readonly mail: MailService,
  ) {}

  async sendVerification(user: Pick<User, 'id' | 'email' | 'name'>) {
    const token = await this.tokens.create(
      user.id,
      OneTimeTokenType.VERIFY_EMAIL,
    );
    await this.mail.sendVerification(user, token);
  }

  async sendPasswordReset(user: Pick<User, 'id' | 'email' | 'name'>) {
    const token = await this.tokens.create(
      user.id,
      OneTimeTokenType.RESET_PASSWORD,
    );
    await this.mail.sendPasswordReset(user, token);
  }

  /** Invitación a una cuenta creada por un administrador: usa el flujo de restablecer contraseña. */
  async sendAdminInvitation(
    user: Pick<User, 'id' | 'email' | 'name'>,
    roleLabel: string,
  ) {
    const token = await this.tokens.create(
      user.id,
      OneTimeTokenType.RESET_PASSWORD,
      ADMIN_INVITATION_TTL_MS,
    );
    await this.mail.sendAdminInvitation(user, roleLabel, token);
  }
}

import { Injectable } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { User } from '../users/user.entity';
import { OneTimeTokenType } from './entities/one-time-token.entity';
import { OneTimeTokensService } from './one-time-tokens.service';

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
}

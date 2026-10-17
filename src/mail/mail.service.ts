import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';
import {
  MailContent,
  providerLinkedTemplate,
  registrationAttemptTemplate,
  resetPasswordTemplate,
  verifyEmailTemplate,
} from './mail.templates';
import { MAIL_TRANSPORT } from './mail.transport';
import type { MailTransport } from './mail.transport';

interface Recipient {
  email: string;
  name: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly frontendUrl: string;

  constructor(
    @Inject(MAIL_TRANSPORT) private readonly transport: MailTransport,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.frontendUrl = config
      .get('FRONTEND_URL', { infer: true })
      .replace(/\/$/, '');
  }

  link(path: string, params?: Record<string, string>) {
    const url = new URL(this.frontendUrl + path);
    for (const [key, value] of Object.entries(params ?? {}))
      url.searchParams.set(key, value);
    return url.toString();
  }

  sendVerification(to: Recipient, token: string) {
    return this.deliver(
      to,
      verifyEmailTemplate(to.name, this.link('/auth/verify-email', { token })),
    );
  }

  sendPasswordReset(to: Recipient, token: string) {
    return this.deliver(
      to,
      resetPasswordTemplate(
        to.name,
        this.link('/auth/reset-password', { token }),
      ),
    );
  }

  sendRegistrationAttempt(to: Recipient) {
    return this.deliver(
      to,
      registrationAttemptTemplate(
        to.name,
        this.link('/auth/login'),
        this.link('/auth/forgot-password'),
      ),
    );
  }

  sendProviderLinked(to: Recipient, provider: string) {
    return this.deliver(to, providerLinkedTemplate(to.name, provider));
  }

  /** Un fallo de correo nunca rompe la petición que lo origina: se registra y se sigue. */
  private async deliver(to: Recipient, content: MailContent) {
    try {
      await this.transport.send({ to: to.email, ...content });
    } catch (error) {
      this.logger.error(
        `No se pudo enviar "${content.subject}" a ${to.email}`,
        error as Error,
      );
    }
  }
}

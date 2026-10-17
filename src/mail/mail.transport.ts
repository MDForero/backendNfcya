import { Logger } from '@nestjs/common';
import { createTransport, Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailTransport {
  send(message: MailMessage): Promise<void>;
}

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');

/** Desarrollo y tests: no envía nada, escribe el correo en el log y lo guarda en memoria. */
export class LogMailTransport implements MailTransport {
  private readonly logger = new Logger('Mail');
  readonly outbox: MailMessage[] = [];

  send(message: MailMessage) {
    this.outbox.push(message);
    this.logger.log(
      `Para: ${message.to} | ${message.subject}\n${message.text}`,
    );
    return Promise.resolve();
  }
}

export interface SmtpOptions {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

export class SmtpMailTransport implements MailTransport {
  private readonly transporter: Transporter;

  constructor(private readonly options: SmtpOptions) {
    this.transporter = createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: options.user
        ? { user: options.user, pass: options.pass }
        : undefined,
    });
  }

  async send(message: MailMessage) {
    await this.transporter.sendMail({ from: this.options.from, ...message });
  }
}

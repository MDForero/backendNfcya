import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';
import { MailService } from './mail.service';
import {
  LogMailTransport,
  MAIL_TRANSPORT,
  SmtpMailTransport,
} from './mail.transport';

@Global()
@Module({
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        config.get('MAIL_TRANSPORT', { infer: true }) === 'smtp'
          ? new SmtpMailTransport({
              host: config.get('SMTP_HOST', { infer: true }),
              port: config.get('SMTP_PORT', { infer: true }),
              secure: config.get('SMTP_SECURE', { infer: true }),
              user: config.get('SMTP_USER', { infer: true }),
              pass: config.get('SMTP_PASS', { infer: true }),
              from: config.get('MAIL_FROM', { infer: true }),
            })
          : new LogMailTransport(),
    },
    MailService,
  ],
  exports: [MailService, MAIL_TRANSPORT],
})
export class MailModule {}

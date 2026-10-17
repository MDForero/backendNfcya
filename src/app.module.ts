import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { envFilePath } from './database/data-source';
import { DatabaseModule } from './database/database.module';
import { MailModule } from './mail/mail.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envFilePath(),
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    MailModule,
    AuditModule,
    UsersModule,
    OrganizationsModule,
    AuthModule,
    AdminModule,
  ],
})
export class AppModule {}

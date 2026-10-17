import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  EnvironmentVariables,
  isGoogleConfigured,
} from '../config/env.validation';
import { UsersModule } from '../users/users.module';
import { AccountEmailsService } from './account-emails.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginAttempt } from './entities/login-attempt.entity';
import { OneTimeToken } from './entities/one-time-token.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { GoogleAuthController } from './google/google-auth.controller';
import { GoogleAuthGuard } from './google/google-auth.guard';
import { GoogleAuthService } from './google/google-auth.service';
import { GoogleStrategy } from './google/google.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { LoginAttemptsService } from './login-attempts.service';
import { MaintenanceService } from './maintenance.service';
import { OneTimeTokensService } from './one-time-tokens.service';
import { RefreshCookieService } from './refresh-cookie.service';
import { SessionsService } from './sessions.service';

/** La estrategia de Google solo se registra en Passport si sus credenciales están configuradas. */
const googleStrategy: Provider = {
  provide: GoogleStrategy,
  inject: [ConfigService],
  useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
    isGoogleConfigured({
      GOOGLE_CLIENT_ID: config.get('GOOGLE_CLIENT_ID', { infer: true }),
      GOOGLE_CLIENT_SECRET: config.get('GOOGLE_CLIENT_SECRET', { infer: true }),
      GOOGLE_CALLBACK_URL: config.get('GOOGLE_CALLBACK_URL', { infer: true }),
    })
      ? new GoogleStrategy(config)
      : null,
};

@Module({
  imports: [
    UsersModule,
    PassportModule,
    TypeOrmModule.forFeature([RefreshToken, OneTimeToken, LoginAttempt]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        throttlers: [
          {
            ttl:
              config.get('AUTH_THROTTLE_TTL_SECONDS', { infer: true }) * 1000,
            limit: config.get('AUTH_THROTTLE_LIMIT', { infer: true }),
          },
        ],
      }),
    }),
  ],
  controllers: [AuthController, GoogleAuthController],
  providers: [
    AuthService,
    SessionsService,
    OneTimeTokensService,
    LoginAttemptsService,
    AccountEmailsService,
    RefreshCookieService,
    MaintenanceService,
    GoogleAuthService,
    GoogleAuthGuard,
    googleStrategy,
    // El orden importa: primero autenticación, después roles.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [SessionsService, AccountEmailsService],
})
export class AuthModule {}

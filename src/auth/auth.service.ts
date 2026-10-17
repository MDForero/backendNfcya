import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { UserStatus } from '../users/role.enum';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AccountEmailsService } from './account-emails.service';
import { AuthErrorCode, RequestMeta } from './auth.types';
import { burnPasswordCheck, hashPassword, verifyPassword } from './crypto.util';
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { OneTimeTokenType } from './entities/one-time-token.entity';
import { LoginAttemptsService } from './login-attempts.service';
import { OneTimeTokensService } from './one-time-tokens.service';
import { SessionsService } from './sessions.service';
import { MailService } from '../mail/mail.service';

export const GENERIC_ACCEPTED = {
  message:
    'Si los datos son correctos, recibirás un correo con las instrucciones.',
};

const invalidToken = () =>
  new BadRequestException({
    statusCode: 400,
    code: AuthErrorCode.INVALID_TOKEN,
    message: 'El enlace no es válido o expiró',
  });

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly oneTimeTokens: OneTimeTokensService,
    private readonly attempts: LoginAttemptsService,
    private readonly accountEmails: AccountEmailsService,
    private readonly mail: MailService,
  ) {}

  /** Responde igual exista o no el email; el rol siempre es CLIENTE. */
  async register(dto: RegisterDto) {
    const passwordHash = await hashPassword(dto.password);
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      this.background(this.mail.sendRegistrationAttempt(existing));
      return GENERIC_ACCEPTED;
    }
    try {
      const user = await this.users.create({
        email: dto.email,
        name: dto.name,
        passwordHash,
      });
      this.background(this.accountEmails.sendVerification(user));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Registro simultáneo con el mismo email: se responde igual que si ya existiera.
    }
    return GENERIC_ACCEPTED;
  }

  async verifyEmail(token: string) {
    const userId = await this.oneTimeTokens.consume(
      token,
      OneTimeTokenType.VERIFY_EMAIL,
    );
    if (!userId) throw invalidToken();
    await this.users.markEmailVerified(userId);
    return { message: 'Correo verificado' };
  }

  async resendVerification(email: string) {
    const user = await this.users.findByEmail(email);
    if (user && !user.emailVerifiedAt)
      this.background(this.accountEmails.sendVerification(user));
    return GENERIC_ACCEPTED;
  }

  async login(dto: LoginDto, meta: RequestMeta) {
    if (await this.attempts.isLocked(dto.email)) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: AuthErrorCode.TOO_MANY_ATTEMPTS,
          message:
            'Demasiados intentos fallidos. Inténtalo de nuevo en unos minutos.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.users.findWithPasswordByEmail(dto.email);
    const valid = user?.passwordHash
      ? await verifyPassword(user.passwordHash, dto.password)
      : await burnPasswordCheck(dto.password);

    await this.attempts.record(dto.email, meta.ip, valid);
    if (!user || !valid) {
      throw new UnauthorizedException({
        statusCode: 401,
        code: AuthErrorCode.INVALID_CREDENTIALS,
        message: 'Email o contraseña incorrectos',
      });
    }

    this.assertCanSignIn(user);
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({
        statusCode: 403,
        code: AuthErrorCode.EMAIL_NOT_VERIFIED,
        message: 'Debes verificar tu correo antes de iniciar sesión',
      });
    }

    return this.sessions.start(user, meta);
  }

  /** Rechaza el inicio de sesión de cuentas suspendidas. */
  assertCanSignIn(user: Pick<User, 'status'>) {
    if (user.status === UserStatus.SUSPENDIDA) {
      throw new ForbiddenException({
        statusCode: 403,
        code: AuthErrorCode.ACCOUNT_SUSPENDED,
        message: 'Tu cuenta está suspendida',
      });
    }
  }

  async forgotPassword(email: string) {
    const user = await this.users.findByEmail(email);
    if (user) this.background(this.accountEmails.sendPasswordReset(user));
    return GENERIC_ACCEPTED;
  }

  /** Restablecer prueba que se controla el correo, así que también lo marca como verificado. */
  async resetPassword(dto: ResetPasswordDto) {
    const userId = await this.oneTimeTokens.consume(
      dto.token,
      OneTimeTokenType.RESET_PASSWORD,
    );
    if (!userId) throw invalidToken();
    await this.users.setPasswordHash(userId, await hashPassword(dto.password));
    await this.users.markEmailVerified(userId);
    await this.sessions.revokeAll(userId);
    return { message: 'Contraseña actualizada' };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    currentRefreshToken?: string,
  ) {
    const user = await this.users.findWithPasswordById(userId);
    const valid = user?.passwordHash
      ? await verifyPassword(user.passwordHash, dto.currentPassword)
      : await burnPasswordCheck(dto.currentPassword);
    if (!valid) {
      throw new BadRequestException({
        statusCode: 400,
        code: AuthErrorCode.INVALID_CREDENTIALS,
        message: 'La contraseña actual no es correcta',
      });
    }
    await this.users.setPasswordHash(
      userId,
      await hashPassword(dto.newPassword),
    );
    await this.sessions.revokeOthers(userId, currentRefreshToken);
    return { message: 'Contraseña actualizada' };
  }

  /** Correos y tokens asociados se generan sin bloquear la respuesta (ni filtrar por tiempo). */
  private background(task: Promise<unknown>) {
    task.catch((error: unknown) =>
      this.logger.error(
        'Falló una tarea de correo en segundo plano',
        error as Error,
      ),
    );
  }
}

function isUniqueViolation(error: unknown) {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code ===
      PG_UNIQUE_VIOLATION
  );
}

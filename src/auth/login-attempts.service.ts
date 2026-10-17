import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { normalizeEmail } from '../users/user.entity';
import { LoginAttempt } from './entities/login-attempt.entity';

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_WINDOW_MS = 15 * 60 * 1000;

/** Bloqueo temporal por email tras varios intentos fallidos de inicio de sesión. */
@Injectable()
export class LoginAttemptsService {
  constructor(
    @InjectRepository(LoginAttempt)
    private readonly attempts: Repository<LoginAttempt>,
  ) {}

  /**
   * Bloqueado si hay MAX_FAILED_ATTEMPTS fallos en la ventana, sin contar los anteriores
   * al último inicio de sesión exitoso.
   */
  async isLocked(email: string) {
    const since = new Date(Date.now() - LOCK_WINDOW_MS);
    const failures = await this.attempts
      .createQueryBuilder('a')
      .where('a.email = :email', { email: normalizeEmail(email) })
      .andWhere('a.succeeded = false')
      .andWhere('a.created_at > :since', { since })
      .andWhere(
        `a.created_at > COALESCE((SELECT MAX(s.created_at) FROM login_attempts s
           WHERE s.email = :email AND s.succeeded = true), '-infinity')`,
      )
      .getCount();
    return failures >= MAX_FAILED_ATTEMPTS;
  }

  async record(email: string, ip: string | null, succeeded: boolean) {
    await this.attempts.insert({ email: normalizeEmail(email), ip, succeeded });
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginAttempt } from './entities/login-attempt.entity';
import { OneTimeToken } from './entities/one-time-token.entity';
import { RefreshToken } from './entities/refresh-token.entity';

export const RETENTION_DAYS = 30;

/** Borra registros de autenticación que ya no sirven y tienen más de RETENTION_DAYS días. */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    @InjectRepository(LoginAttempt)
    private readonly attempts: Repository<LoginAttempt>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(OneTimeToken)
    private readonly oneTimeTokens: Repository<OneTimeToken>,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purge(now = new Date()) {
    const cutoff = new Date(
      now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    const attempts = await this.attempts
      .createQueryBuilder()
      .delete()
      .where('created_at < :cutoff', { cutoff })
      .execute();

    // Un refresh token sirve mientras no haya vencido ni se haya revocado.
    const refresh = await this.refreshTokens
      .createQueryBuilder()
      .delete()
      .where('expires_at < :cutoff OR revoked_at < :cutoff', { cutoff })
      .execute();

    const oneTime = await this.oneTimeTokens
      .createQueryBuilder()
      .delete()
      .where('expires_at < :cutoff OR used_at < :cutoff', { cutoff })
      .execute();

    const result = {
      loginAttempts: attempts.affected ?? 0,
      refreshTokens: refresh.affected ?? 0,
      oneTimeTokens: oneTime.affected ?? 0,
    };
    this.logger.log(`Limpieza de autenticación: ${JSON.stringify(result)}`);
    return result;
  }
}

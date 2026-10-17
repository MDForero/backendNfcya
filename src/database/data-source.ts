import { existsSync } from 'node:fs';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AuditLog } from '../audit/audit-log.entity';
import { LoginAttempt } from '../auth/entities/login-attempt.entity';
import { OneTimeToken } from '../auth/entities/one-time-token.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { Organization } from '../organizations/organization.entity';
import { UserIdentity } from '../users/user-identity.entity';
import { User } from '../users/user.entity';
import { MIGRATIONS } from './migrations';

export const ENTITIES = [
  Organization,
  User,
  UserIdentity,
  RefreshToken,
  OneTimeToken,
  LoginAttempt,
  AuditLog,
];

/** Archivo de entorno según NODE_ENV: `.env.test` para los tests, `.env` para lo demás. */
export function envFilePath() {
  return process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
}

/** Carga el .env en process.env para la CLI de TypeORM y los scripts (la app usa ConfigModule). */
export function loadEnvFile() {
  const file = envFilePath();
  if (existsSync(file)) process.loadEnvFile(file);
}

export function buildDataSourceOptions(
  url: string,
  logging = false,
): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    migrationsTableName: 'migrations',
    synchronize: false,
    logging,
  };
}

loadEnvFile();

/** Usado por la CLI de TypeORM (pnpm migration:*). */
export default new DataSource(
  buildDataSourceOptions(
    process.env.DATABASE_URL ?? '',
    process.env.DATABASE_LOGGING === 'true',
  ),
);

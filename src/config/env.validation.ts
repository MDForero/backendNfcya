import 'reflect-metadata';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

const toBoolean = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

export class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  PORT = 3000;

  @IsUrl({ require_tld: false })
  FRONTEND_URL: string;

  @IsString()
  DATABASE_URL: string;

  @Transform(toBoolean)
  @IsBoolean()
  DATABASE_LOGGING = false;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  JWT_ACCESS_TTL_SECONDS = 900;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  REFRESH_TOKEN_TTL_DAYS = 30;

  @Transform(toBoolean)
  @IsBoolean()
  COOKIE_SECURE = true;

  @IsIn(['lax', 'strict', 'none'])
  COOKIE_SAMESITE: 'lax' | 'strict' | 'none' = 'lax';

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  COOKIE_DOMAIN?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_ID?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_SECRET?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUrl({ require_tld: false })
  GOOGLE_CALLBACK_URL?: string;

  @IsIn(['log', 'smtp'])
  MAIL_TRANSPORT: 'log' | 'smtp' = 'log';

  @IsString()
  MAIL_FROM = 'nfcYA <no-reply@nfcya.com>';

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  SMTP_HOST?: string;

  @Type(() => Number)
  @IsInt()
  SMTP_PORT = 587;

  @Transform(toBoolean)
  @IsBoolean()
  SMTP_SECURE = false;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  SMTP_USER?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  SMTP_PASS?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_THROTTLE_LIMIT = 20;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  AUTH_THROTTLE_TTL_SECONDS = 60;
}

/** Valida y tipa process.env al arrancar; lanza un error con todas las variables inválidas. */
export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const detail = errors
      .map(
        (e) =>
          `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
      )
      .join('; ');
    throw new Error(`Configuración de entorno inválida: ${detail}`);
  }
  if (validated.MAIL_TRANSPORT === 'smtp' && !validated.SMTP_HOST) {
    throw new Error(
      'Configuración de entorno inválida: SMTP_HOST es obligatorio con MAIL_TRANSPORT=smtp',
    );
  }
  if (validated.COOKIE_SAMESITE === 'none' && !validated.COOKIE_SECURE) {
    throw new Error(
      'Configuración de entorno inválida: COOKIE_SAMESITE=none exige COOKIE_SECURE=true',
    );
  }
  return validated;
}

export function isGoogleConfigured(
  env: Pick<
    EnvironmentVariables,
    'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET' | 'GOOGLE_CALLBACK_URL'
  >,
) {
  return Boolean(
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL,
  );
}

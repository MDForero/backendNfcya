import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { EnvironmentVariables } from './config/env.validation';

/** Configuración HTTP compartida por main.ts y los tests e2e. */
export function setupApp(app: INestApplication) {
  const config =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  const trustProxy = config.get('TRUST_PROXY', { infer: true });
  if (trustProxy > 0) {
    // Solo Express: req.ip pasa a ser la IP del cliente según X-Forwarded-For.
    (
      app.getHttpAdapter().getInstance() as {
        set: (key: string, value: unknown) => void;
      }
    ).set('trust proxy', trustProxy);
  }

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      // Los campos no declarados en el DTO (p. ej. role en el registro) se descartan.
      whitelist: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: config.get('FRONTEND_URL', { infer: true }).replace(/\/$/, ''),
    credentials: true,
  });
  app.enableShutdownHooks();
  return app;
}

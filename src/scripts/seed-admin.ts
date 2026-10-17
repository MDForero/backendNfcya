import { ConsoleLogger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnv } from '../config/env.validation';
import { envFilePath } from '../database/data-source';
import { DatabaseModule } from '../database/database.module';
import { BootstrapAdminService } from '../users/bootstrap-admin.service';
import { User } from '../users/user.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envFilePath(),
      validate: validateEnv,
    }),
    DatabaseModule,
    TypeOrmModule.forFeature([User]),
  ],
  providers: [BootstrapAdminService],
})
class SeedModule {}

// Logger propio: el contexto de Nest arranca solo con niveles error/warn para no llenar la salida.
const logger = new ConsoleLogger('seed:admin');

/** pnpm seed:admin — crea el primer SUPER_ADMIN desde BOOTSTRAP_ADMIN_*. Es idempotente. */
async function main() {
  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['error', 'warn'],
  });
  try {
    const result = await app.get(BootstrapAdminService).run({
      email: process.env.BOOTSTRAP_ADMIN_EMAIL,
      password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
      name: process.env.BOOTSTRAP_ADMIN_NAME,
    });
    logger.log(
      result === 'created'
        ? `SUPER_ADMIN creado (${process.env.BOOTSTRAP_ADMIN_EMAIL}). Retira BOOTSTRAP_ADMIN_* del entorno.`
        : 'Ya existe un SUPER_ADMIN: no se hicieron cambios.',
    );
  } finally {
    await app.close();
  }
}

main().catch((error: Error) => {
  logger.error(error.message);
  process.exit(1);
});

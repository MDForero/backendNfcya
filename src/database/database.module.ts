import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnvironmentVariables } from '../config/env.validation';
import { buildDataSourceOptions } from './data-source';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) =>
        buildDataSourceOptions(
          config.get('DATABASE_URL', { infer: true }),
          config.get('DATABASE_LOGGING', { infer: true }),
        ),
    }),
  ],
})
export class DatabaseModule {}

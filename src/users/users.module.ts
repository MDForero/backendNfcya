import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserIdentity } from './user-identity.entity';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { BootstrapAdminService } from './bootstrap-admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserIdentity])],
  controllers: [UsersController],
  providers: [UsersService, BootstrapAdminService],
  exports: [UsersService, BootstrapAdminService, TypeOrmModule],
})
export class UsersModule {}

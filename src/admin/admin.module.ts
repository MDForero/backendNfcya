import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { UsersModule } from '../users/users.module';
import { UsersAdminController } from './users-admin.controller';
import { UsersAdminService } from './users-admin.service';

/** Rutas /admin/users: dependen de usuarios, sesiones, correo y auditoría. */
@Module({
  imports: [UsersModule, AuthModule, OrganizationsModule, AuditModule],
  controllers: [UsersAdminController],
  providers: [UsersAdminService],
})
export class AdminModule {}

import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { LeadsModule } from '../leads/leads.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { UsersModule } from '../users/users.module';
import { ProfilesAdminController } from './profiles-admin.controller';
import { ProfilesAdminService } from './profiles-admin.service';
import { UsersAdminController } from './users-admin.controller';
import { UsersAdminService } from './users-admin.service';

/** Rutas /admin/users y /admin/profiles: dependen de usuarios, sesiones, correo y auditoría. */
@Module({
  imports: [
    UsersModule,
    AuthModule,
    OrganizationsModule,
    AuditModule,
    ProfilesModule,
    LeadsModule,
  ],
  controllers: [UsersAdminController, ProfilesAdminController],
  providers: [UsersAdminService, ProfilesAdminService],
})
export class AdminModule {}

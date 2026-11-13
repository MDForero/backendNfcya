import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/pagination.dto';
import { Role } from '../users/role.enum';
import { User } from '../users/user.entity';
import { ListProfilesQueryDto } from './dto/admin-profiles.dto';
import { ProfilesAdminService } from './profiles-admin.service';

const ADMIN = Role.SUPER_ADMIN;
const SUPPORT = Role.SOPORTE;
const COMPANY = Role.EMPRESA;

@Controller('admin/profiles')
export class ProfilesAdminController {
  constructor(private readonly admin: ProfilesAdminService) {}

  @Get()
  @Roles(ADMIN, SUPPORT, COMPANY)
  list(@CurrentUser() actor: User, @Query() query: ListProfilesQueryDto) {
    return this.admin.list(actor, query);
  }

  @Get(':id')
  @Roles(ADMIN, SUPPORT, COMPANY)
  get(@CurrentUser() actor: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.get(actor, id);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @Roles(ADMIN, COMPANY)
  suspend(@CurrentUser() actor: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.suspend(actor, id);
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @Roles(ADMIN, COMPANY)
  reactivate(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.admin.reactivate(actor, id);
  }

  /** Leads con datos personales: solo SUPER_ADMIN, además del propietario (/profiles/me/leads). */
  @Get(':id/leads')
  @Roles(ADMIN)
  leads(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.admin.listLeads(actor, id, query);
  }
}

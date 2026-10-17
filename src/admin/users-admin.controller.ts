import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/role.enum';
import { User } from '../users/user.entity';
import {
  ChangeOrganizationDto,
  ChangeRoleDto,
  ListUsersQueryDto,
} from './dto/admin-users.dto';
import { UsersAdminService } from './users-admin.service';

const ADMIN = Role.SUPER_ADMIN;
const SUPPORT = Role.SOPORTE;
const COMPANY = Role.EMPRESA;

@Controller('admin/users')
export class UsersAdminController {
  constructor(private readonly admin: UsersAdminService) {}

  @Get()
  @Roles(ADMIN, SUPPORT, COMPANY)
  list(@CurrentUser() actor: User, @Query() query: ListUsersQueryDto) {
    return this.admin.list(actor, query);
  }

  @Get(':id')
  @Roles(ADMIN, SUPPORT, COMPANY)
  get(@CurrentUser() actor: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.get(actor, id);
  }

  @Patch(':id/role')
  @Roles(ADMIN)
  changeRole(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeRoleDto,
  ) {
    return this.admin.changeRole(actor, id, dto.role);
  }

  @Patch(':id/organization')
  @Roles(ADMIN)
  changeOrganization(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeOrganizationDto,
  ) {
    return this.admin.changeOrganization(actor, id, dto.organizationId);
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

  @Post(':id/resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(ADMIN, SUPPORT)
  resendVerification(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.admin.resendVerification(actor, id);
  }

  @Post(':id/send-password-reset')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(ADMIN, SUPPORT)
  sendPasswordReset(
    @CurrentUser() actor: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.admin.sendPasswordReset(actor, id);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/pagination.dto';
import { Role } from '../users/role.enum';
import { OrganizationDto } from './dto/organization.dto';
import { OrganizationsService } from './organizations.service';

@Controller('admin/organizations')
@Roles(Role.SUPER_ADMIN)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.SOPORTE)
  list(@Query() query: PaginationQueryDto) {
    return this.organizations.list(query);
  }

  @Post()
  create(@Body() dto: OrganizationDto) {
    return this.organizations.create(dto.name);
  }

  @Patch(':id')
  rename(@Param('id', ParseUUIDPipe) id: string, @Body() dto: OrganizationDto) {
    return this.organizations.rename(id, dto.name);
  }
}

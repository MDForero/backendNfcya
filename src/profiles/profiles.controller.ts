import {
  Body,
  Controller,
  Delete,
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
  ChangeIdentifierStatusDto,
  CreateIdentifierDto,
} from './dto/identifier.dto';
import { CreateLinkDto, ReorderLinksDto, UpdateLinkDto } from './dto/link.dto';
import {
  CreateProfileDto,
  SlugAvailabilityQueryDto,
  UpdateProfileDto,
} from './dto/profile.dto';
import { ProfileIdentifiersService } from './profile-identifiers.service';
import { ProfileLinksService } from './profile-links.service';
import { ProfilesService } from './profiles.service';

/**
 * Gestión del perfil propio. Las rutas nunca reciben el ID del perfil: siempre se
 * deriva del usuario autenticado, así no hay forma de apuntar a uno ajeno (IDOR).
 */
@Controller('profiles')
@Roles(Role.CLIENTE, Role.EMPRESA)
export class ProfilesController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly links: ProfileLinksService,
    private readonly identifiers: ProfileIdentifiersService,
  ) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateProfileDto) {
    return this.profiles.create(user, dto);
  }

  @Get('me')
  getMine(@CurrentUser() user: User) {
    return this.profiles.getOwnView(user);
  }

  @Patch('me')
  update(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.profiles.update(user, dto);
  }

  @Get('slug-availability')
  slugAvailability(
    @CurrentUser() user: User,
    @Query() query: SlugAvailabilityQueryDto,
  ) {
    return this.profiles.slugAvailability(user, query.slug);
  }

  @Post('me/publish')
  @HttpCode(HttpStatus.OK)
  publish(@CurrentUser() user: User) {
    return this.profiles.publish(user);
  }

  @Post('me/unpublish')
  @HttpCode(HttpStatus.OK)
  unpublish(@CurrentUser() user: User) {
    return this.profiles.unpublish(user);
  }

  // --- Enlaces ---

  @Get('me/links')
  listLinks(@CurrentUser() user: User) {
    return this.links.list(user);
  }

  @Post('me/links')
  createLink(@CurrentUser() user: User, @Body() dto: CreateLinkDto) {
    return this.links.create(user, dto);
  }

  // Declarada antes de :id para que "reorder" no se interprete como un ID.
  @Patch('me/links/reorder')
  reorderLinks(@CurrentUser() user: User, @Body() dto: ReorderLinksDto) {
    return this.links.reorder(user, dto.ids);
  }

  @Patch('me/links/:id')
  updateLink(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLinkDto,
  ) {
    return this.links.update(user, id, dto);
  }

  @Delete('me/links/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeLink(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.links.remove(user, id);
  }

  // --- NFC / QR ---

  @Get('me/identifiers')
  listIdentifiers(@CurrentUser() user: User) {
    return this.identifiers.list(user);
  }

  @Post('me/identifiers')
  createIdentifier(
    @CurrentUser() user: User,
    @Body() dto: CreateIdentifierDto,
  ) {
    return this.identifiers.create(user, dto);
  }

  @Patch('me/identifiers/:id/status')
  changeIdentifierStatus(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeIdentifierStatusDto,
  ) {
    return this.identifiers.changeStatus(user, id, dto.status);
  }
}

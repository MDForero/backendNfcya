import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/pagination.dto';
import { PublicWriteThrottle } from '../common/public-throttle';
import { Role } from '../users/role.enum';
import { User } from '../users/user.entity';
import { CreateLeadDto, LEAD_CONSENT_PURPOSE } from './dto/lead.dto';
import { LeadsService } from './leads.service';

@Controller('profiles')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  /** Texto de finalidad que el formulario público debe mostrar. */
  @Get('public/leads/consent')
  @Public()
  consent() {
    return { purpose: LEAD_CONSENT_PURPOSE };
  }

  @Post('public/:slug/leads')
  @Public()
  @UseGuards(ThrottlerGuard)
  @PublicWriteThrottle()
  @HttpCode(HttpStatus.CREATED)
  create(@Param('slug') slug: string, @Body() dto: CreateLeadDto) {
    return this.leads.create(slug, dto);
  }

  @Get('me/leads')
  @Roles(Role.CLIENTE, Role.EMPRESA)
  listMine(@CurrentUser() user: User, @Query() query: PaginationQueryDto) {
    return this.leads.listOwn(user, query);
  }

  @Delete('me/leads/:id')
  @Roles(Role.CLIENTE, Role.EMPRESA)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMine(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leads.removeOwn(user, id);
  }
}

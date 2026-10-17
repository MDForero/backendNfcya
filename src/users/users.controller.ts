import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateMeDto } from './dto/update-me.dto';
import { User } from './user.entity';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() user: User) {
    return this.view(user.id);
  }

  @Patch('me')
  async updateMe(@CurrentUser() user: User, @Body() dto: UpdateMeDto) {
    await this.users.updateName(user.id, dto.name);
    return this.view(user.id);
  }

  private async view(id: string) {
    const view = await this.users.getView(id);
    if (!view) throw new NotFoundException();
    return view;
  }
}

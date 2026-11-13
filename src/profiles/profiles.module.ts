import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileIdentifier } from './entities/profile-identifier.entity';
import { ProfileLink } from './entities/profile-link.entity';
import { Profile } from './entities/profile.entity';
import { ProfileIdentifiersService } from './profile-identifiers.service';
import { ProfileLinksService } from './profile-links.service';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { PublicProfilesController } from './public-profiles.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Profile, ProfileLink, ProfileIdentifier]),
  ],
  controllers: [ProfilesController, PublicProfilesController],
  providers: [ProfilesService, ProfileLinksService, ProfileIdentifiersService],
  exports: [ProfilesService, TypeOrmModule],
})
export class ProfilesModule {}

import { Controller, Get, Header, Param, Res, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { PublicReadThrottle } from '../common/public-throttle';
import { ProfileIdentifiersService } from './profile-identifiers.service';
import { profileUrl, toPublicView } from './profile.views';
import { ProfilesService } from './profiles.service';
import { buildVCard } from './vcard.util';

/** Rutas sin sesión: perfil publicado, vCard y resolución de códigos NFC/QR. */
@Controller()
@Public()
@UseGuards(ThrottlerGuard)
@PublicReadThrottle()
export class PublicProfilesController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly identifiers: ProfileIdentifiersService,
  ) {}

  @Get('profiles/public/:slug')
  @Header('Cache-Control', 'no-store')
  async getPublic(@Param('slug') slug: string) {
    return toPublicView(await this.profiles.findPublished(slug));
  }

  @Get('profiles/public/:slug/vcard')
  async vcard(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const profile = await this.profiles.findPublished(slug);
    const view = toPublicView(profile);
    res.set({
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${profile.slug}.vcf"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return buildVCard({ ...view, profileUrl: profileUrl(profile.slug) });
  }

  @Get('resolve/:code')
  @Header('Cache-Control', 'no-store')
  resolve(@Param('code') code: string) {
    return this.identifiers.resolve(code);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Page, PaginationQueryDto } from '../common/pagination.dto';
import { ProfilesService } from '../profiles/profiles.service';
import { User } from '../users/user.entity';
import { CreateLeadDto } from './dto/lead.dto';
import { Lead, LeadSource } from './lead.entity';

export function toLeadView(lead: Lead) {
  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    message: lead.message,
    source: lead.source,
    createdAt: lead.createdAt,
  };
}
export type LeadView = ReturnType<typeof toLeadView>;

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    private readonly profiles: ProfilesService,
  ) {}

  /** Solo perfiles publicados con captura activada; el consentimiento ya lo exigió el DTO. */
  async create(slug: string, dto: CreateLeadDto) {
    const profile = await this.profiles.findPublished(slug);
    if (!profile.leadsEnabled)
      throw new NotFoundException('Este perfil no recibe contactos');
    await this.leads.save(
      this.leads.create({
        profileId: profile.id,
        name: dto.name,
        email: dto.email || null,
        phone: dto.phone || null,
        message: dto.message || null,
        consentAccepted: true,
        source: dto.source ?? LeadSource.PROFILE,
      }),
    );
    return { received: true };
  }

  async listOwn(user: User, query: PaginationQueryDto) {
    const profile = await this.profiles.getOwn(user);
    return this.listForProfile(profile.id, query);
  }

  async removeOwn(user: User, id: string) {
    const profile = await this.profiles.getOwn(user);
    const result = await this.leads.delete({ id, profileId: profile.id });
    if (!result.affected) throw new NotFoundException('Contacto no encontrado');
  }

  async listForProfile(
    profileId: string,
    query: PaginationQueryDto,
  ): Promise<Page<LeadView>> {
    const [items, total] = await this.leads.findAndCount({
      where: { profileId },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return {
      items: items.map(toLeadView),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}

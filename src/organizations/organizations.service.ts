import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Page, PaginationQueryDto } from '../common/pagination.dto';
import { Organization } from './organization.entity';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
  ) {}

  async list({
    page,
    pageSize,
  }: PaginationQueryDto): Promise<Page<Organization>> {
    const [items, total] = await this.organizations.findAndCount({
      order: { name: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  findById(id: string) {
    return this.organizations.findOne({ where: { id } });
  }

  create(name: string) {
    return this.organizations.save(this.organizations.create({ name }));
  }

  async rename(id: string, name: string) {
    const organization = await this.findById(id);
    if (!organization)
      throw new NotFoundException('Organización no encontrada');
    organization.name = name;
    return this.organizations.save(organization);
  }
}

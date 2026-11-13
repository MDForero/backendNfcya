import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LinkType } from '../profile.enums';
import { Profile } from './profile.entity';

@Entity('profile_links')
@Index('IDX_profile_links_profile_order', ['profileId', 'sortOrder'])
export class ProfileLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'profile_id', type: 'uuid' })
  profileId: string;

  @ManyToOne(() => Profile, (profile) => profile.links, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'profile_id' })
  profile?: Profile;

  @Column({ length: 60 })
  label: string;

  @Column({ length: 2048 })
  url: string;

  @Column({
    type: 'enum',
    enum: LinkType,
    enumName: 'link_type',
    default: LinkType.OTHER,
  })
  type: LinkType;

  @Column({ name: 'sort_order', type: 'int' })
  sortOrder: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

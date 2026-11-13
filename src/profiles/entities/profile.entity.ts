import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';
import { ProfileStatus, ProfileTheme } from '../profile.enums';
import { ProfileLink } from './profile-link.entity';

/**
 * Perfil digital. Un usuario tiene como máximo uno; la organización se toma del
 * propietario (no se duplica aquí para que no quede desincronizada).
 */
@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_profiles_owner', { unique: true })
  @Column({ name: 'owner_user_id', type: 'uuid' })
  ownerUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_user_id' })
  owner?: User;

  /** Normalizado con normalizeSlug; único en BD. */
  @Index('UQ_profiles_slug', { unique: true })
  @Column({ length: 40 })
  slug: string;

  @Column({ name: 'display_name', length: 120 })
  displayName: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  headline: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  bio: string | null;

  @Column({ name: 'avatar_url', type: 'varchar', length: 2048, nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'cover_url', type: 'varchar', length: 2048, nullable: true })
  coverUrl: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  website: string | null;

  @Column({
    name: 'location_label',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  locationLabel: string | null;

  /** El email/teléfono solo se muestran (y van en la vCard) si el propietario lo autoriza. */
  @Column({ name: 'show_email', default: false })
  showEmail: boolean;

  @Column({ name: 'show_phone', default: false })
  showPhone: boolean;

  @Column({ name: 'leads_enabled', default: false })
  leadsEnabled: boolean;

  @Column({
    type: 'enum',
    enum: ProfileTheme,
    enumName: 'profile_theme',
    default: ProfileTheme.DEFAULT,
  })
  theme: ProfileTheme;

  @Index('IDX_profiles_status')
  @Column({
    type: 'enum',
    enum: ProfileStatus,
    enumName: 'profile_status',
    default: ProfileStatus.DRAFT,
  })
  status: ProfileStatus;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'suspended_at', type: 'timestamptz', nullable: true })
  suspendedAt: Date | null;

  @OneToMany(() => ProfileLink, (link) => link.profile)
  links?: ProfileLink[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

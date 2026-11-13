import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Profile } from '../profiles/entities/profile.entity';

export enum LeadSource {
  PROFILE = 'PROFILE',
  NFC = 'NFC',
  QR = 'QR',
}

/** Contacto dejado por un visitante. Solo se guarda con consentimiento explícito. */
@Entity('leads')
@Index('IDX_leads_profile_created', ['profileId', 'createdAt'])
@Check('CHK_leads_consent', `"consent_accepted" = true`)
@Check('CHK_leads_contact', `"email" IS NOT NULL OR "phone" IS NOT NULL`)
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'profile_id', type: 'uuid' })
  profileId: string;

  @ManyToOne(() => Profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile?: Profile;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  message: string | null;

  @Column({ name: 'consent_accepted' })
  consentAccepted: boolean;

  @Column({
    type: 'enum',
    enum: LeadSource,
    enumName: 'lead_source',
    default: LeadSource.PROFILE,
  })
  source: LeadSource;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

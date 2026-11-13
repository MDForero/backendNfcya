import {
  Equals,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Trim } from '../../common/trim.transform';
import { LeadSource } from '../lead.entity';

/** Finalidad mostrada al visitante; el frontend debe enseñarla junto a la casilla. */
export const LEAD_CONSENT_PURPOSE =
  'Autorizo que el titular de este perfil use mis datos solo para contactarme.';

export class CreateLeadDto {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(120)
  name: string;

  /** Hace falta email o teléfono; el que llegue se valida. */
  @ValidateIf((dto: CreateLeadDto) => dto.email !== undefined || !dto.phone)
  @Trim()
  @IsEmail({}, { message: 'Indica un email válido o un teléfono' })
  @MaxLength(254)
  email?: string;

  @ValidateIf((dto: CreateLeadDto) => dto.phone !== undefined || !dto.email)
  @Trim()
  @Matches(/^\+?[0-9 ()-]{7,30}$/, {
    message: 'Indica un teléfono válido o un email',
  })
  phone?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @Equals(true, {
    message: 'Debes aceptar el tratamiento de datos para enviar tus datos',
  })
  consentAccepted: boolean;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;
}

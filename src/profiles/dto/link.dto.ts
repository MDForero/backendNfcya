import { PartialType } from '@nestjs/mapped-types';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../common/trim.transform';
import { LinkType, MAX_LINKS_PER_PROFILE } from '../profile.enums';
import { IsSafeLinkUrl, MAX_URL_LENGTH } from '../safe-url';

export class CreateLinkDto {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'La etiqueta es obligatoria' })
  @MaxLength(60)
  label: string;

  @Trim()
  @IsString()
  @MaxLength(MAX_URL_LENGTH)
  @IsSafeLinkUrl()
  url: string;

  @IsOptional()
  @IsEnum(LinkType, {
    message: `type debe ser uno de: ${Object.values(LinkType).join(', ')}`,
  })
  type?: LinkType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLinkDto extends PartialType(CreateLinkDto) {}

export class ReorderLinksDto {
  /** Todos los IDs de enlaces del perfil, en el orden deseado. */
  @IsArray()
  @ArrayMaxSize(MAX_LINKS_PER_PROFILE)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  ids: string[];
}

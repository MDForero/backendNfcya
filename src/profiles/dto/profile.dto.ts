import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNotIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Trim } from '../../common/trim.transform';
import { ProfileTheme } from '../profile.enums';
import { IsWebLink } from '../safe-url';
import {
  normalizeSlug,
  RESERVED_SLUGS,
  SLUG_MAX,
  SLUG_MIN,
  SLUG_PATTERN,
} from '../slug.util';

/** Strings vacíos → null: permite borrar un campo opcional enviando "". */
const EmptyToNull = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? null : value,
  );

const NormalizeSlug = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeSlug(value) : value,
  );

/** null/undefined se aceptan (borrar o no tocar); cualquier otro valor se valida. */
const Nullable = () =>
  ValidateIf((_o, value: unknown) => value !== null && value !== undefined);

export class SlugField {
  @NormalizeSlug()
  @IsString()
  @Length(SLUG_MIN, SLUG_MAX, {
    message: `El slug debe tener entre ${SLUG_MIN} y ${SLUG_MAX} caracteres`,
  })
  @Matches(SLUG_PATTERN, {
    message: 'El slug solo admite letras minúsculas, números y guiones',
  })
  @IsNotIn(RESERVED_SLUGS, { message: 'Ese slug está reservado' })
  slug: string;
}

export class CreateProfileDto extends SlugField {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'El nombre visible es obligatorio' })
  @MaxLength(120)
  displayName: string;

  @Trim()
  @EmptyToNull()
  @Nullable()
  @IsString()
  @MaxLength(160)
  headline?: string | null;

  @Trim()
  @EmptyToNull()
  @Nullable()
  @IsString()
  @MaxLength(1000)
  bio?: string | null;

  @Trim()
  @EmptyToNull()
  @Nullable()
  @IsWebLink(true)
  avatarUrl?: string | null;

  @Trim()
  @EmptyToNull()
  @Nullable()
  @IsWebLink(true)
  coverUrl?: string | null;

  @Trim()
  @EmptyToNull()
  @Nullable()
  @Matches(/^\+?[0-9 ()-]{7,30}$/, {
    message:
      'El teléfono solo admite dígitos, espacios, paréntesis, guiones y +',
  })
  phone?: string | null;

  @Trim()
  @EmptyToNull()
  @Nullable()
  @IsEmail({}, { message: 'El email de contacto no es válido' })
  @MaxLength(254)
  email?: string | null;

  @Trim()
  @EmptyToNull()
  @Nullable()
  @IsWebLink()
  website?: string | null;

  @Trim()
  @EmptyToNull()
  @Nullable()
  @IsString()
  @MaxLength(120)
  locationLabel?: string | null;

  @IsOptional()
  @IsBoolean()
  showEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  showPhone?: boolean;

  @IsOptional()
  @IsBoolean()
  leadsEnabled?: boolean;

  @IsOptional()
  @IsEnum(ProfileTheme, {
    message: `theme debe ser uno de: ${Object.values(ProfileTheme).join(', ')}`,
  })
  theme?: ProfileTheme;
}

export class UpdateProfileDto extends PartialType(CreateProfileDto) {}

export class SlugAvailabilityQueryDto {
  @IsString()
  @MaxLength(200)
  slug: string;
}

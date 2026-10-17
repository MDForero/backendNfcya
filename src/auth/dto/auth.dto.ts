import { applyDecorators } from '@nestjs/common';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../common/trim.transform';

/** Mínimo 8 caracteres con al menos una letra y un número. */
export const PasswordPolicy = () =>
  applyDecorators(
    IsString(),
    Length(8, 128, {
      message: 'La contraseña debe tener entre 8 y 128 caracteres',
    }),
    Matches(/[A-Za-z]/, {
      message: 'La contraseña debe incluir al menos una letra',
    }),
    Matches(/\d/, { message: 'La contraseña debe incluir al menos un número' }),
  );

const EmailField = () =>
  applyDecorators(
    Trim(),
    IsEmail({}, { message: 'Email inválido' }),
    MaxLength(254),
  );

export class RegisterDto {
  @Trim()
  @IsString()
  @Length(2, 120)
  name: string;

  @EmailField()
  email: string;

  @PasswordPolicy()
  password: string;
}

export class LoginDto {
  @EmailField()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}

export class EmailDto {
  @EmailField()
  email: string;
}

export class TokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token: string;
}

export class ResetPasswordDto extends TokenDto {
  @PasswordPolicy()
  password: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword: string;

  @PasswordPolicy()
  newPassword: string;
}

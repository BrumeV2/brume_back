import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
const passwordPattern =
  /^(?=[\s\S]*\p{Lu})(?=[\s\S]*[0-9])(?=[\s\S]*[\p{P}\p{S}])/u;
const passwordDescription =
  'De 8 à 128 caractères, avec au moins une majuscule, un chiffre et un caractère spécial.';

export class EmailDto {
  @ApiProperty({ format: 'email' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
export class LoginDto extends EmailDto {
  @ApiProperty({ minLength: 1, maxLength: 128 })
  @IsString()
  @Length(1, 128)
  password!: string;
}
export class RegisterDto extends EmailDto {
  @ApiProperty({
    minLength: 8,
    maxLength: 128,
    description: passwordDescription,
  })
  @IsString()
  @Length(8, 128)
  @Matches(passwordPattern, { message: passwordDescription })
  password!: string;
}
export class TokenDto {
  @ApiProperty({ description: 'Jeton à usage unique reçu par email.' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token!: string;
}
export class ResetPasswordDto extends TokenDto {
  @ApiProperty({
    minLength: 8,
    maxLength: 128,
    description: passwordDescription,
  })
  @IsString()
  @Length(8, 128)
  @Matches(passwordPattern, { message: passwordDescription })
  password!: string;
}

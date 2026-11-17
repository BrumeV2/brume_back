import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export class UpdateProfileDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 100, example: 'Camille' })
  @Trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 100, example: 'Martin' })
  @Trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    pattern: '^0[1-9]\\d{8}$',
    example: '0612345678',
  })
  @Trim()
  @IsOptional()
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsString()
  @Matches(/^0[1-9]\d{8}$/)
  phone?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 255,
    example: '12 rue des Lilas',
  })
  @Trim()
  @IsOptional()
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsString()
  @MaxLength(255)
  address?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    pattern: '^\\d{5}$',
    example: '69003',
  })
  @Trim()
  @IsOptional()
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsString()
  @Matches(/^\d{5}$/)
  postalCode?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    minLength: 1,
    maxLength: 100,
    example: 'Lyon',
  })
  @Trim()
  @IsOptional()
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city?: string | null;

  @ApiPropertyOptional({ type: Boolean, example: true })
  @IsOptional()
  @IsBoolean()
  doNewsletter?: boolean;
}

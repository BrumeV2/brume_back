import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

export class CreateAddressDto {
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName!: string;
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName!: string;
  @ApiProperty({ minLength: 1, maxLength: 200 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  line1!: string;
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 200 })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string | null;
  @ApiProperty({ pattern: '^\\d{5}$', example: '69003' })
  @Trim()
  @IsString()
  @Matches(/^\d{5}$/)
  postalCode!: string;
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;
  @ApiProperty({ enum: ['FR'] })
  @Trim()
  @IsString()
  @Length(2, 2)
  country!: string;
  @ApiProperty({ pattern: '^0[1-9]\\d{8}$' })
  @Trim()
  @IsString()
  @Matches(/^0[1-9]\d{8}$/)
  phone!: string;
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 50 })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  label?: string | null;
  @ApiPropertyOptional({ default: false })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto, {
  skipNullProperties: false,
}) {}

export class AddressResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiProperty() line1!: string;
  @ApiProperty({ type: String, nullable: true }) line2!: string | null;
  @ApiProperty() postalCode!: string;
  @ApiProperty() city!: string;
  @ApiProperty({ enum: ['FR'] }) country!: string;
  @ApiProperty() phone!: string;
  @ApiProperty({ type: String, nullable: true }) label!: string | null;
  @ApiProperty() isDefault!: boolean;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

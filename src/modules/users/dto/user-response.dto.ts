import { ApiProperty } from '@nestjs/swagger';
import { AccountStatus, Role } from '../entities/user.entity';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty({ type: String, nullable: true }) firstName!: string | null;
  @ApiProperty({ type: String, nullable: true }) lastName!: string | null;
  @ApiProperty({ type: String, nullable: true }) phone!: string | null;
  @ApiProperty({ enum: Role }) role!: Role;
  @ApiProperty({ enum: AccountStatus }) status!: AccountStatus;
  @ApiProperty({ format: 'date-time' }) emailVerifiedAt!: Date;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
}

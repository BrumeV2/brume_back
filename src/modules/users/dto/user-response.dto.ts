import { ApiProperty } from '@nestjs/swagger';
import { AccountStatus, Role } from '../entities/user.entity';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Identifiant du profil' })
  id!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Identifiant du compte utilisateur',
  })
  userId!: string;

  @ApiProperty({ format: 'email', example: 'camille.martin@example.com' })
  email!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Camille' })
  firstName!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Martin' })
  lastName!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '0612345678' })
  phone!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '12 rue des Lilas' })
  address!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '69003' })
  postalCode!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Lyon' })
  city!: string | null;

  @ApiProperty({ type: Number, example: 0, description: 'Points de fidélité' })
  loyaltyPoints!: number;

  @ApiProperty({
    type: Boolean,
    example: false,
    description: 'Inscription newsletter',
  })
  doNewsletter!: boolean;

  @ApiProperty({ enum: Role })
  role!: Role;

  @ApiProperty({ enum: AccountStatus })
  status!: AccountStatus;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  emailVerifiedAt!: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}

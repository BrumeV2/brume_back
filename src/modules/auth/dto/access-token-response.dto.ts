import { ApiProperty } from '@nestjs/swagger';
export class AccessTokenResponseDto {
  @ApiProperty({
    description:
      'Jeton opaque de session, utilisable dans Authorization: Bearer. Révoqué à la déconnexion ou après reset du mot de passe.',
  })
  accessToken!: string;
  @ApiProperty({ enum: ['Bearer'] })
  tokenType!: 'Bearer';
  @ApiProperty({
    type: 'integer',
    description: 'Durée de validité en secondes.',
  })
  expiresIn!: number;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorDto {
  @ApiPropertyOptional({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        field: { type: 'string' },
        constraints: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  details?: { field: string; constraints: string[] }[];
  @ApiProperty() statusCode!: number;
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
  @ApiProperty() path!: string;
  @ApiProperty({ format: 'date-time' }) timestamp!: string;
}

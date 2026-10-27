import { ApiProperty } from '@nestjs/swagger';

export class ApiErrorDto {
  @ApiProperty() statusCode!: number;
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
  @ApiProperty() path!: string;
  @ApiProperty({ format: 'date-time' }) timestamp!: string;
}

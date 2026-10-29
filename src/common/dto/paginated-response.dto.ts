import { ApiProperty } from '@nestjs/swagger';
export class PaginationMetaDto {
  @ApiProperty({ type: 'integer' })
  page: number;
  @ApiProperty({ type: 'integer' })
  limit: number;
  @ApiProperty({ type: 'integer' })
  total: number;
  @ApiProperty({ type: 'integer' })
  totalPages: number;
}

export class PaginatedResponseDto<T> {
  data: T[];
  meta: PaginationMetaDto;

  constructor(
    data: T[],
    total: number,
    { page, limit }: { page: number; limit: number },
  ) {
    this.data = data;
    this.meta = { page, limit, total, totalPages: Math.ceil(total / limit) };
  }
}

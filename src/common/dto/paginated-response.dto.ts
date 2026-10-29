export class PaginationMetaDto {
  page: number;
  limit: number;
  total: number;
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

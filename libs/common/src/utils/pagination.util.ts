import { PaginationMeta } from '../interfaces/response.interface';

export function createPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  const total_pages = Math.ceil(total / limit);

  return {
    total,
    limit,
    page,
    total_pages,
    has_next: page < total_pages,
    has_previous: page > 1,
  };
}

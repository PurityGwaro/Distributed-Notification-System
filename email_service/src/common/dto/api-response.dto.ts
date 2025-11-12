export interface PaginationMeta {
  total: number;
  limit: number;
  page: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message: string;
  meta?: PaginationMeta;
}

export class ApiResponseDto<T> implements ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message: string;
  meta?: PaginationMeta;

  static success<T>(data: T, message = 'Success'): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
    };
  }

  static successWithMeta<T>(
    data: T,
    meta: PaginationMeta,
    message = 'Success',
  ): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
      meta,
    };
  }

  static error(error: string, message = 'Error occurred'): ApiResponse<null> {
    return {
      success: false,
      error,
      message,
    };
  }
}

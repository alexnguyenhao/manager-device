export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL'

export class AppError extends Error {
  readonly code: ErrorCode

  constructor(message: string, code: ErrorCode = 'BAD_REQUEST') {
    super(message)
    this.name = 'AppError'
    this.code = code
  }
}

export function notFound(entity: string): AppError {
  return new AppError(`Không tìm thấy ${entity}.`, 'NOT_FOUND')
}

export function conflict(message: string): AppError {
  return new AppError(message, 'CONFLICT')
}

export function unauthorized(message = 'Bạn cần đăng nhập để tiếp tục.'): AppError {
  return new AppError(message, 'UNAUTHORIZED')
}

export function forbidden(message = 'Bạn không có quyền thực hiện thao tác này.'): AppError {
  return new AppError(message, 'FORBIDDEN')
}

export function messageOf(error: unknown): string {
  if (error instanceof AppError) return error.message
  if (error instanceof Error) {
    if (/UNIQUE constraint failed: (.+)/.test(error.message)) {
      const field = error.message.match(/UNIQUE constraint failed: (.+)/)?.[1] ?? ''
      return `Dữ liệu bị trùng lặp (${field}). Vui lòng kiểm tra lại.`
    }
    if (/FOREIGN KEY constraint failed/.test(error.message)) {
      return 'Dữ liệu đang được sử dụng ở nơi khác, không thể xóa.'
    }
    return error.message
  }
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.'
}

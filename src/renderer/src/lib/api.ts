import type { WindowApi } from '@shared/api'

export const api: WindowApi = window.api

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.'
}

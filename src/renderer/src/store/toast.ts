import { create } from 'zustand'

export type ToastKind = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: number
  kind: ToastKind
  title: string
  description?: string
}

let counter = 0

interface ToastState {
  items: ToastItem[]
  push: (kind: ToastKind, title: string, description?: string) => void
  dismiss: (id: number) => void
}

export const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  push: (kind, title, description) => {
    const id = ++counter
    set({ items: [...get().items, { id, kind, title, description }] })
    window.setTimeout(() => {
      set({ items: get().items.filter((item) => item.id !== id) })
    }, kind === 'error' ? 6500 : 4200)
  },
  dismiss: (id) => set({ items: get().items.filter((item) => item.id !== id) })
}))

export const toast = {
  success: (title: string, description?: string): void =>
    useToastStore.getState().push('success', title, description),
  error: (title: string, description?: string): void =>
    useToastStore.getState().push('error', title, description),
  info: (title: string, description?: string): void =>
    useToastStore.getState().push('info', title, description),
  warning: (title: string, description?: string): void =>
    useToastStore.getState().push('warning', title, description)
}

import { create } from 'zustand'
import type { AuthUser } from '@shared/types'
import { api } from '../lib/api'

interface AuthState {
  user: AuthUser | null
  initializing: boolean
  loggingIn: boolean
  init: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: AuthUser | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initializing: true,
  loggingIn: false,
  init: async () => {
    try {
      const user = await api.auth.me()
      set({ user, initializing: false })
    } catch {
      set({ user: null, initializing: false })
    }
  },
  login: async (username, password) => {
    set({ loggingIn: true })
    try {
      const user = await api.auth.login(username, password)
      set({ user, loggingIn: false })
    } catch (error) {
      set({ loggingIn: false })
      throw error
    }
  },
  logout: async () => {
    try {
      await api.auth.logout()
    } finally {
      set({ user: null })
    }
  },
  setUser: (user) => set({ user })
}))

export function useCurrentUser(): AuthUser {
  return useAuthStore((state) => state.user) as AuthUser
}

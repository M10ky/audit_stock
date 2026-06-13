// TODO: Phase correspondante — usePermissions
'use client'
import { useAuthStore } from '@/store/authStore'
import { getPermissions } from '@/lib/permissions'

/**
 * Hook léger pour accéder aux permissions n'importe où.
 * Usage : const { canManIT, isAdmin } = usePermissions()
 */
export function usePermissions() {
  const profile = useAuthStore((s) => s.profile)
  return getPermissions(profile)
}
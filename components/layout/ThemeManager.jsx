'use client'
import { useEffect } from 'react'
import { useUiStore } from '@/store/uiStore'

export default function ThemeManager() {
  const theme     = useUiStore(s => s.theme)
  const initTheme = useUiStore(s => s.initTheme)
  const hasThemePreference = useUiStore(s => s.hasThemePreference)

  useEffect(() => { initTheme() }, [initTheme])
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.colorScheme = theme
  }, [theme])
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (!hasThemePreference()) initTheme()
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [initTheme, hasThemePreference])

  return null
}
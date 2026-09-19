'use client'
import { useEffect } from 'react'
import { useUiStore } from '@/store/uiStore'

export default function ThemeManager() {
  const theme     = useUiStore(s => s.theme)
  const initTheme = useUiStore(s => s.initTheme)

  useEffect(() => { initTheme() }, [initTheme])
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return null
}
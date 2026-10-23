'use client'

import { useEffect, useState } from 'react'

const key = 'recipeshare-demo-saved'
export function useSavedRecipes() {
  const [saved, setSaved] = useState<number[]>([])
  useEffect(() => {
    function read() {
      try {
        const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
        if (Array.isArray(value)) setSaved(value.filter((id): id is number => typeof id === 'number'))
      } catch { /* Storage may be unavailable in private browsing. */ }
    }
    read()
    window.addEventListener('storage', read)
    return () => window.removeEventListener('storage', read)
  }, [])

  function toggle(id: number) {
    const next = saved.includes(id) ? saved.filter(item => item !== id) : [...saved, id]
    setSaved(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* Keep the in-memory demo usable. */ }
  }
  return [saved, toggle] as const
}

'use client'
import { useEffect, useState } from 'react'
const key = 'recipeshare-demo-followed'
export function useFollowedAuthors() {
  const [authors, setAuthors] = useState<string[]>([])
  useEffect(() => {
    function read() {
      try {
        const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
        if (Array.isArray(value)) setAuthors(value.filter((item): item is string => typeof item === 'string'))
      } catch { /* Retain the in-memory state when storage is unavailable. */ }
    }
    read()
    window.addEventListener('storage', read)
    return () => window.removeEventListener('storage', read)
  }, [])
  function toggle(author: string) {
    const next = authors.includes(author) ? authors.filter(item => item !== author) : [...authors, author]
    setAuthors(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* Keep the demo usable. */ }
  }
  return [authors, toggle] as const
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function logout() {
    if (pending) return
    setPending(true)
    setError('')

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      })

      if (!response.ok) {
        setError('Unable to sign out. Please try again.')
        return
      }

      router.replace('/')
      router.refresh()
    } catch {
      setError('Unable to reach the server.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      <button type="button" onClick={logout} disabled={pending}>
        {pending ? 'Signing out...' : 'Sign out'}
      </button>
      <p role="status">{error}</p>
    </div>
  )
}
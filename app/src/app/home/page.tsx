import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { LogoutButton } from '@/components/logout-button'

async function AuthenticatedHome() {
  const user = await getSessionUser()

  if (!user) redirect('/')

  return (
    <main style={{ maxWidth: 720, margin: '80px auto', padding: 24 }}>
      <h1>Welcome, {user.displayName}</h1>
      <p>You are signed in as {user.username}.</p>
      <LogoutButton />
    </main>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<p>Loading your session...</p>}>
      <AuthenticatedHome />
    </Suspense>
  )
}
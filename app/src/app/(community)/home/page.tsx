import { ChefLoader } from '@/components/chef-loader'
import { Suspense } from 'react'
import { getSessionUser } from '@/lib/auth/session'
import { CommunityHome } from '@/components/community/home'

async function HomeWithSession() {
  const user = await getSessionUser()
  return <CommunityHome user={user} />
}
export default function HomePage() {
  return <Suspense fallback={<ChefLoader />}><HomeWithSession /></Suspense>
}

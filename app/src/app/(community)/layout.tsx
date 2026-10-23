import { ChefLoader } from '@/components/chef-loader'
import { Suspense, type ReactNode } from 'react'
import { PersistentCommunityShell } from '@/components/community/persistent-shell'

export default function Layout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<ChefLoader />}><PersistentCommunityShell>{children}</PersistentCommunityShell></Suspense>
}

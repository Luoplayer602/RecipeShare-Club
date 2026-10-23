import { ChefLoader } from '@/components/chef-loader'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { postIdSchema } from '@/lib/posts/post-id'
import { CommunityPost } from '@/components/community/post'

async function PostWithSession({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!postIdSchema.safeParse(id).success) notFound()
  const user = await getSessionUser()
  return <CommunityPost id={id} user={user} />
}
export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<ChefLoader />}><PostWithSession params={params} /></Suspense>
}

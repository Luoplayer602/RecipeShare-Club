import { ChefLoader } from '@/components/chef-loader'
import { Suspense } from 'react'
import { redirect, notFound } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { postIdSchema } from '@/lib/posts/post-id'
import Editor from '@/components/editor/editor'

async function ProtectedEditor({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) redirect('/')
  const { id } = await params
  if (!postIdSchema.safeParse(id).success) notFound()
  return <Editor key={id} postId={id} user={user} />
}
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<ChefLoader />}><ProtectedEditor params={params} /></Suspense>
}

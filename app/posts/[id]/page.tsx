import { notFound } from 'next/navigation'
import { recipes } from '@/lib/recipes'
import { PostReader } from '@/components/post-reader'

export function generateStaticParams() {
  return recipes.map(recipe => ({ id: String(recipe.id) }))
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const recipe = recipes.find(item => String(item.id) === id)
  if (!recipe) notFound()
  return <PostReader key={recipe.id} recipe={recipe} />
}

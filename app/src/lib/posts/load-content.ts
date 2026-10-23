import 'server-only'

import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  recipeDetails,
  recipeIngredients,
  postBlocks,
  postTags,
  tags,
} from '@/db/schema'

export type PostTransaction =
  Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function loadPostContent(
  tx: PostTransaction,
  postId: string,
  type: 'recipe' | 'blog',
) {
  let recipe = null

  if (type === 'recipe') {
    const [details] = await tx
      .select({
        prepMinutes: recipeDetails.prepMinutes,
        cookMinutes: recipeDetails.cookMinutes,
        servings: recipeDetails.servings,
        difficulty: recipeDetails.difficulty,
      })
      .from(recipeDetails)
      .where(eq(recipeDetails.postId, postId))
      .limit(1)

    if (!details) {
      throw new Error('Recipe details are missing.')
    }

    const ingredients = await tx
      .select({
        name: recipeIngredients.name,
        quantity: recipeIngredients.quantity,
        unit: recipeIngredients.unit,
        note: recipeIngredients.note,
        position: recipeIngredients.position,
      })
      .from(recipeIngredients)
      .where(eq(recipeIngredients.postId, postId))
      .orderBy(asc(recipeIngredients.position))

    recipe = { ...details, ingredients }
  }

  const blocks = await tx
    .select({
      data: postBlocks.data,
      position: postBlocks.position,
    })
    .from(postBlocks)
    .where(eq(postBlocks.postId, postId))
    .orderBy(asc(postBlocks.position))

  const tagList = await tx
    .select({
      id: tags.id,
      name: tags.name,
      slug: tags.slug,
    })
    .from(postTags)
    .innerJoin(tags, eq(postTags.tagId, tags.id))
    .where(eq(postTags.postId, postId))
    .orderBy(asc(tags.name), asc(tags.id))

  return { recipe, blocks, tags: tagList }
}
import 'server-only'

import { randomUUID } from 'node:crypto'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  mediaAssets,
  posts,
  postBlocks,
  postTags,
  recipeDetails,
  recipeIngredients,
  tags,
} from '@/db/schema'
import type { SaveEditorInput } from './editor-validation'

type SaveDraftResult =
  | { ok: true; postId: string; updatedAt: Date }
  | {
      ok: false
      status: 404 | 409 | 422
      code: string
    }

export async function saveDraft(
  postId: string,
  userId: string,
  input: SaveEditorInput,
): Promise<SaveDraftResult> {
  return db.transaction(async tx => {
    const [post] = await tx
      .select({
        id: posts.id,
        type: posts.type,
        status: posts.status,
      })
      .from(posts)
      .where(and(
        eq(posts.id, postId),
        eq(posts.authorId, userId),
        isNull(posts.deletedAt),
      ))
      .limit(1)
      .for('update')

    if (!post) {
      return { ok: false, status: 404, code: 'POST_NOT_FOUND' }
    }

    if (post.status !== 'draft') {
      return { ok: false, status: 409, code: 'POST_NOT_DRAFT' }
    }

    if (
      (post.type === 'recipe' && input.recipe === null) ||
      (post.type === 'blog' && input.recipe !== null)
    ) {
      return { ok: false, status: 422, code: 'INVALID_RECIPE_DATA' }
    }

    const references: Array<{
      id: string
      kind: 'image' | 'video'
    }> = []

    if (input.coverMediaId) {
      references.push({ id: input.coverMediaId, kind: 'image' })
    }

    for (const block of input.blocks) {
      if (block.type === 'image' || block.type === 'video') {
        references.push({
          id: block.mediaId,
          kind: block.type,
        })
      }
    }

    if (references.length > 0) {
      const mediaIds = [...new Set(references.map(item => item.id))]

      const available = await tx
        .select({
          id: mediaAssets.id,
          kind: mediaAssets.kind,
        })
        .from(mediaAssets)
        .where(and(
          inArray(mediaAssets.id, mediaIds),
          eq(mediaAssets.ownerId, userId),
        ))

      const valid = references.every(reference =>
        available.some(asset =>
          asset.id === reference.id &&
          asset.kind === reference.kind,
        ),
      )

      if (!valid) {
        return { ok: false, status: 422, code: 'INVALID_MEDIA' }
      }
    }

    const updatedAt = new Date()

    await tx.update(posts).set({
      title: input.title,
      excerpt: input.excerpt,
      coverMediaId: input.coverMediaId,
      updatedAt,
    }).where(eq(posts.id, postId))

    if (input.recipe !== null) {
      const recipe = input.recipe

      await tx.insert(recipeDetails).values({
        postId,
        prepMinutes: recipe.prepMinutes,
        cookMinutes: recipe.cookMinutes,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
      }).onDuplicateKeyUpdate({
        set: {
          prepMinutes: recipe.prepMinutes,
          cookMinutes: recipe.cookMinutes,
          servings: recipe.servings,
          difficulty: recipe.difficulty,
        },
      })

      await tx.delete(recipeIngredients)
        .where(eq(recipeIngredients.postId, postId))

      if (recipe.ingredients.length > 0) {
        await tx.insert(recipeIngredients).values(
          recipe.ingredients.map((ingredient, position) => ({
            ...ingredient,
            postId,
            position,
          })),
        )
      }
    }

    await tx.delete(postBlocks)
      .where(eq(postBlocks.postId, postId))

    if (input.blocks.length > 0) {
      await tx.insert(postBlocks).values(
        input.blocks.map((data, position) => ({
          postId,
          data,
          position,
        })),
      )
    }

    const tagIds = new Set<string>()

    // Use a consistent order to reduce concurrent tag creation deadlocks.
    const tagNames = [...new Set(
      input.tagNames.map(name => name.normalize('NFKC').trim()),
    )].sort()

    for (const name of tagNames) {
      const slugBase = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40)
        .replace(/-+$/g, '')

      await tx.insert(tags).values({
        name,
        slug: `${slugBase || 'tag'}-${randomUUID()}`,
        createdBy: userId,
      }).onDuplicateKeyUpdate({
        set: { id: sql`${tags.id}` },
      })

      const [tag] = await tx
        .select({ id: tags.id })
        .from(tags)
        .where(eq(tags.name, name))
        .limit(1)

      if (!tag) throw new Error('Tag resolution failed.')

      tagIds.add(tag.id)
    }

    await tx.delete(postTags)
      .where(eq(postTags.postId, postId))

    if (tagIds.size > 0) {
      await tx.insert(postTags).values(
        [...tagIds].map(tagId => ({ postId, tagId })),
      )
    }

    return { ok: true, postId, updatedAt }
  })
}
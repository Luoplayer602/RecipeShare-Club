import 'server-only'

import { and, eq, inArray, isNull, max } from 'drizzle-orm'
import { db } from '@/db'
import {
  postEdits,
  mediaAssets,
  posts,
  postRevisions,
  type PostRevisionSnapshot,
} from '@/db/schema'
import { saveDraft } from './save-draft'
import { loadPostContent } from './load-content'
import { publishEditorSchema } from './publish-validation'

type PublishResult =
  | {
      ok: true
      postId: string
      slug: string
      version: number
      publishedAt: Date
    }
  | {
      ok: false
      status: 404 | 409 | 422
      code: string
      issues?: Array<{
        path: string
        message: string
      }>
    }

export async function publishPost(
  postId: string,
  userId: string,
): Promise<PublishResult> {
  return db.transaction(async tx => {
    const [post] = await tx
      .select()
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

    if (post.status !== 'draft' && post.status !== 'published') {
      return { ok: false, status: 409, code: 'POST_NOT_DRAFT' }
    }

    const [editing]=await tx.select().from(postEdits).where(eq(postEdits.postId,postId)).limit(1)
    if(post.status==='published'&&!editing)return {ok:false,status:409,code:'NO_SAVED_CHANGES'}
    if(editing){
      const check=publishEditorSchema.safeParse(editing.content)
      if(!check.success)return {ok:false,status:422,code:'PUBLISH_VALIDATION_ERROR',issues:check.error.issues.map(issue=>({path:issue.path.join('.'),message:issue.message}))}
      const applied=await saveDraft(postId,userId,editing.content,tx,true)
      if(!applied.ok)return applied
      Object.assign(post,{title:editing.content.title,excerpt:editing.content.excerpt,coverMediaId:editing.content.coverMediaId})
    }
    const content = await loadPostContent(tx, postId, post.type)

    const validated = publishEditorSchema.safeParse({
      title: post.title,
      excerpt: post.excerpt,
      coverMediaId: post.coverMediaId,
      recipe: content.recipe === null
        ? null
        : {
            ...content.recipe,
            ingredients: content.recipe.ingredients.map(
              ({ position: _position, ...ingredient }) => {
                void _position
                return ingredient
              },
            ),
          },
      blocks: content.blocks.map(block => block.data),
      tagNames: content.tags.map(tag => tag.name),
    })

    if (!validated.success) {
      if(editing)throw new Error('Publication validation changed during update.')
      return {
        ok: false,
        status: 422,
        code: 'PUBLISH_VALIDATION_ERROR',
        issues: validated.error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      }
    }

    const references: Array<{
      id: string
      kind: 'image' | 'video'
    }> = []

    if (post.coverMediaId) {
      references.push({ id: post.coverMediaId, kind: 'image' })
    }

    for (const block of content.blocks) {
      const data = block.data

      if (data.type === 'image' || data.type === 'video') {
        references.push({
          id: data.mediaId,
          kind: data.type,
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
        if(editing)throw new Error('Publication media changed during update.')
        return { ok: false, status: 422, code: 'INVALID_MEDIA' }
      }
    }

    const [latest] = await tx
      .select({ version: max(postRevisions.version) })
      .from(postRevisions)
      .where(eq(postRevisions.postId, postId))

    const version = Number(latest?.version ?? 0) + 1
    const now = new Date()
    const publishedAt = post.publishedAt ?? now

    const snapshot: PostRevisionSnapshot = {
      schemaVersion: 1,
      type: post.type,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      coverMediaId: post.coverMediaId,
      recipe: content.recipe,
      blocks: content.blocks,
      tags: content.tags,
    }

    await tx.insert(postRevisions).values({
      postId,
      version,
      editedBy: userId,
      snapshot,
    })

    await tx.update(posts).set({
      status: 'published',
      publishedAt,
      updatedAt: now,
    }).where(eq(posts.id, postId))

    await tx.delete(postEdits).where(eq(postEdits.postId,postId))

    return {
      ok: true,
      postId,
      slug: post.slug,
      version,
      publishedAt,
    }
  })
}
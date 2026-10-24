import {measureApi} from '@/lib/monitoring/metrics'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/db'
import {
  postEdits,
  mediaAssets,
  posts,
  recipeDetails,
  recipeIngredients,
  postBlocks,
  postTags,
  tags,
} from '@/db/schema'
import { getSessionUser } from '@/lib/auth/session'
import { postIdSchema } from '@/lib/posts/post-id'
import { saveEditorSchema } from '@/lib/posts/editor-validation'
import { hasInvalidOrigin, readEditorJson } from '@/lib/posts/request'
import { saveDraft } from '@/lib/posts/save-draft'
import { z } from 'zod'

const headers = { 'Cache-Control': 'no-store' }

function respond(body: unknown, status: number) {
  return Response.json(body, { status, headers })
}

type Context = {
  params: Promise<{ id: string }>
}

async function GETHandler(_request: Request, context: Context) {
  let stage = 'session'
  try {
    const user = await getSessionUser()

    if (!user) {
      return respond({ code: 'UNAUTHENTICATED' }, 401)
    }

    stage = 'params'
    const params = await context.params
    const parsedId = postIdSchema.safeParse(params.id)

    if (!parsedId.success) {
      return respond({ code: 'INVALID_POST_ID' }, 400)
    }

    const postId = parsedId.data

    stage = 'transaction'
    const editorData = await db.transaction(async tx => {
      stage = 'post'
      const [post] = await tx
        .select({
          id: posts.id,
          type: posts.type,
          title: posts.title,
          slug: posts.slug,
          excerpt: posts.excerpt,
          coverMediaId: posts.coverMediaId,
          status: posts.status,
          publishedAt: posts.publishedAt,
          createdAt: posts.createdAt,
          updatedAt: posts.updatedAt,
        })
        .from(posts)
        .where(and(
          eq(posts.id, postId),
          eq(posts.authorId, user.id),
          isNull(posts.deletedAt),
        ))
        .limit(1)

      if (!post) return null

      let recipe = null

      if (post.type === 'recipe') {
        stage = 'recipe-details'
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

        stage = 'ingredients'
        const ingredients = await tx
          .select({
            id: recipeIngredients.id,
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

      stage = 'blocks'
      const blocks = await tx
        .select({
          id: postBlocks.id,
          data: postBlocks.data,
          position: postBlocks.position,
        })
        .from(postBlocks)
        .where(eq(postBlocks.postId, postId))
        .orderBy(asc(postBlocks.position))

      stage = 'tags'
      const postTagList = await tx
        .select({
          id: tags.id,
          name: tags.name,
          slug: tags.slug,
        })
        .from(postTags)
        .innerJoin(tags, eq(postTags.tagId, tags.id))
        .where(eq(postTags.postId, postId))
        .orderBy(asc(tags.name), asc(tags.id))

      const [editing]=await tx.select().from(postEdits).where(eq(postEdits.postId,postId)).limit(1)
      if(editing){
        const input=editing.content
        const ids=[...new Set([input.coverMediaId,...input.blocks.flatMap(block=>'mediaId' in block?[block.mediaId]:[])].filter((id):id is string=>!!id))]
        const media=ids.length?await tx.select({id:mediaAssets.id,kind:mediaAssets.kind,source:mediaAssets.source,mimeType:mediaAssets.mimeType,url:mediaAssets.externalUrl}).from(mediaAssets).where(inArray(mediaAssets.id,ids)):[]
        return {...post,title:input.title,excerpt:input.excerpt,coverMediaId:input.coverMediaId,updatedAt:editing.updatedAt,
          recipe:input.recipe?{...input.recipe,ingredients:input.recipe.ingredients.map((row,position)=>({...row,position}))}:null,
          blocks:input.blocks.map((data,position)=>({id:`edit-${position}`,data,position})),tags:input.tagNames.map((name,index)=>({id:`edit-tag-${index}`,name,slug:name})),media}
      }
      const mediaIds = new Set<string>()
      if (post.coverMediaId) mediaIds.add(post.coverMediaId)
      for (const block of blocks) if ('mediaId' in block.data) mediaIds.add(block.data.mediaId)
      const media = mediaIds.size ? await tx.select({ id: mediaAssets.id, kind: mediaAssets.kind,
        source: mediaAssets.source, mimeType: mediaAssets.mimeType, url: mediaAssets.externalUrl,
      }).from(mediaAssets).where(inArray(mediaAssets.id, [...mediaIds])) : []

      return {
        ...post,
        recipe,
        blocks,
        tags: postTagList,
        media,
      }
    }, {
      isolationLevel: 'repeatable read',
      accessMode: 'read only',
    })

    if (!editorData) {
      return respond({ code: 'POST_NOT_FOUND' }, 404)
    }

    return respond({ post: editorData }, 200)
  } catch (error) {
    const errors: Record<string, unknown>[] = []
    let current: unknown = error
    for (let depth = 0; depth < 5; depth++) {
      if (typeof current !== 'object' || current === null) break
      const details = current as Record<string, unknown>
      const summary: Record<string, unknown> = {}
      for (const key of ['name', 'code', 'errno', 'sqlState']) {
        if (key in details) summary[key] = details[key]
      }
      if (current instanceof TypeError || current instanceof ReferenceError) {
        summary.message = current.message
      }
      errors.push(summary)
      current = details.cause
    }
    console.error('[posts/edit] Read failed:', { stage, errors })
    return respond({ code: 'POST_READ_UNAVAILABLE' }, 503)
  }
}

async function PATCHHandler(request: Request, context: Context) {
  if (hasInvalidOrigin(request)) {
    return respond({ code: 'INVALID_ORIGIN' }, 403)
  }

  try {
    const user = await getSessionUser()

    if (!user) {
      return respond({ code: 'UNAUTHENTICATED' }, 401)
    }

    const params = await context.params
    const parsedId = postIdSchema.safeParse(params.id)

    if (!parsedId.success) {
      return respond({ code: 'INVALID_POST_ID' }, 400)
    }

    const bodyResult = await readEditorJson(request)

    if (!bodyResult.ok) {
      return respond(
        { code: bodyResult.code },
        bodyResult.status,
      )
    }

    const parsedInput = saveEditorSchema.safeParse(bodyResult.body)

    if (!parsedInput.success) {
      return respond({
        code: 'VALIDATION_ERROR',
        errors: z.flattenError(parsedInput.error),
      }, 422)
    }

    const result = await saveDraft(
      parsedId.data,
      user.id,
      parsedInput.data,
    )

    if (!result.ok) {
      return respond({ code: result.code }, result.status)
    }

    return respond({
      message: 'Draft saved.',
      post: {
        id: result.postId,
        updatedAt: result.updatedAt,
      },
    }, 200)
  } catch {
    return respond({ code: 'POST_SAVE_UNAVAILABLE' }, 503)
  }
}
export const GET=measureApi("/api/posts/[id]/edit","GET",GETHandler)

export const PATCH=measureApi("/api/posts/[id]/edit","PATCH",PATCHHandler)

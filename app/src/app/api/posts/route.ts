import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { db } from '@/db'
import { getSessionUser } from '@/lib/auth/session'
import { createDraftSchema } from '@/lib/posts/validation'
// Replace the existing drizzle-orm import.
import {
  and,
  count,
  desc,
  eq,
  exists,
  isNull,
  sql,
} from 'drizzle-orm'

// Add users, postTags, and tags to the existing schema import.
import {
  mediaAssets,
  posts,
  recipeDetails,
  users,
  postTags,
  tags,
} from '@/db/schema'

import { listPostsQuerySchema } from '@/lib/posts/list-validation'



const headers = { 'Cache-Control': 'no-store' }

function respond(body: unknown, status: number) {
  return Response.json(body, { status, headers })
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  const fetchSite = request.headers.get('sec-fetch-site')

  if (
    fetchSite === 'cross-site' ||
    (origin !== null && origin !== new URL(request.url).origin)
  ) {
    return respond({ code: 'INVALID_ORIGIN' }, 403)
  }

  const contentType = request.headers.get('content-type')
    ?.split(';')[0]
    .trim()
    .toLowerCase()

  if (contentType !== 'application/json') {
    return respond({ code: 'JSON_REQUIRED' }, 415)
  }

  try {
    const user = await getSessionUser()

    if (!user) {
      return respond({ code: 'UNAUTHENTICATED' }, 401)
    }

    let body: unknown

    try {
      const reader = request.body?.getReader()
      if (!reader) return respond({ code: 'INVALID_JSON' }, 400)

      const chunks: Uint8Array[] = []
      let size = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        size += value.byteLength

        if (size > 8192) {
          await reader.cancel()
          return respond({ code: 'BODY_TOO_LARGE' }, 413)
        }

        chunks.push(value)
      }

      body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch {
      return respond({ code: 'INVALID_JSON' }, 400)
    }

    const result = createDraftSchema.safeParse(body)

    if (!result.success) {
      return respond({
        code: 'VALIDATION_ERROR',
        errors: z.flattenError(result.error),
      }, 422)
    }

    const input = result.data
    const id = randomUUID()

    // Keep the UUID suffix to make slugs unique and stable.
    const titleSlug = input.title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 180)
      .replace(/-+$/g, '')

    const slug = `${titleSlug || 'post'}-${id}`

    const created = await db.transaction(async tx => {
      if (input.coverMediaId) {
        const [cover] = await tx
          .select({ id: mediaAssets.id })
          .from(mediaAssets)
          .where(and(
            eq(mediaAssets.id, input.coverMediaId),
            eq(mediaAssets.ownerId, user.id),
            eq(mediaAssets.kind, 'image'),
          ))
          .limit(1)

        if (!cover) return false
      }

      await tx.insert(posts).values({
        id,
        authorId: user.id,
        type: input.type,
        title: input.title,
        slug,
        excerpt: input.excerpt,
        coverMediaId: input.coverMediaId,
        status: 'draft',
      })

      if (input.type === 'recipe') {
        await tx.insert(recipeDetails).values({ postId: id })
      }

      return true
    })

    if (!created) {
      return respond({
        code: 'INVALID_COVER',
        message: 'Cover image is unavailable or does not belong to you.',
      }, 422)
    }

    return respond({
      message: 'Draft created.',
      post: {
        id,
        type: input.type,
        title: input.title,
        slug,
        status: 'draft',
      },
    }, 201)
  } catch {
    return respond({ code: 'POST_CREATION_UNAVAILABLE' }, 503)
  }
}

export async function GET(request: Request) {
  const parsed = listPostsQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  )

  if (!parsed.success) {
    return respond({
      code: 'INVALID_QUERY',
      errors: z.flattenError(parsed.error),
    }, 400)
  }

  const query = parsed.data

  try {
    const result = await db.transaction(async tx => {
      const conditions = [
        eq(posts.status, 'published'),
        isNull(posts.deletedAt),
      ]

      if (query.type) {
        conditions.push(eq(posts.type, query.type))
      }

      if (query.q) {
        // Parameterized literal substring search.
        conditions.push(
          sql`LOCATE(${query.q}, ${posts.title}) > 0`,
        )
      }

      if (query.tag) {
        conditions.push(exists(
          tx.select({ postId: postTags.postId })
            .from(postTags)
            .innerJoin(tags, eq(postTags.tagId, tags.id))
            .where(and(
              eq(postTags.postId, posts.id),
              eq(tags.slug, query.tag),
            )),
        ))
      }

      const filter = and(...conditions)

      const [totalRow] = await tx
        .select({ total: count() })
        .from(posts)
        .where(filter)

      const items = await tx
        .select({
          id: posts.id,
          type: posts.type,
          title: posts.title,
          slug: posts.slug,
          excerpt: posts.excerpt,
          coverMediaId: posts.coverMediaId,
          publishedAt: posts.publishedAt,
          author: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
          },
          recipe: {
            prepMinutes: recipeDetails.prepMinutes,
            cookMinutes: recipeDetails.cookMinutes,
            servings: recipeDetails.servings,
            difficulty: recipeDetails.difficulty,
          },
        })
        .from(posts)
        .innerJoin(users, eq(posts.authorId, users.id))
        .leftJoin(recipeDetails, eq(recipeDetails.postId, posts.id))
        .where(filter)
        .orderBy(desc(posts.publishedAt), desc(posts.id))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit)

      const total = Number(totalRow?.total ?? 0)

      return {
        posts: items.map(item => ({
          ...item,
          recipe: item.type === 'recipe' ? item.recipe : null,
          coverUrl: item.coverMediaId
            ? `/api/media/${item.coverMediaId}/file`
            : null,
        })),
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
          hasNext: query.page * query.limit < total,
        },
      }
    }, {
      isolationLevel: 'repeatable read',
      accessMode: 'read only',
    })

    return respond(result, 200)
  } catch {
    console.error('[posts/list] Read failed.')
    return respond({ code: 'POST_LIST_UNAVAILABLE' }, 503)
  }
}

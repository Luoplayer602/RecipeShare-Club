import {measureApi} from '@/lib/monitoring/metrics'
import { hasInvalidOrigin } from '@/lib/http/origin'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { db } from '@/db'
import { getSessionUser } from '@/lib/auth/session'
import { createDraftSchema } from '@/lib/posts/validation'
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  sql,
} from 'drizzle-orm'

import {
  userFollows,
  savedPosts,
  mediaAssets,
  posts,
  recipeDetails,
  users,
  userTitles,
  postTags,
  tags,
} from '@/db/schema'

import { listPostsQuerySchema } from '@/lib/posts/list-validation'



const headers = { 'Cache-Control': 'no-store' }

function respond(body: unknown, status: number) {
  return Response.json(body, { status, headers })
}

async function POSTHandler(request: Request) {
  if (hasInvalidOrigin(request)) {
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

async function GETHandler(request: Request) {
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
    const viewer = query.saved || query.following ? await getSessionUser() : null
    if ((query.saved || query.following) && !viewer) return respond({ code: 'UNAUTHENTICATED' }, 401)
    const result = await db.transaction(async tx => {
      const conditions = [
        eq(posts.status, 'published'),
        isNull(posts.deletedAt),
      ]

      if (viewer && query.saved) conditions.push(exists(tx.select({ id: savedPosts.postId }).from(savedPosts).where(and(eq(savedPosts.postId, posts.id), eq(savedPosts.userId, viewer.id)))))
      const followingScope = viewer && query.following ? exists(tx.select({ id: userFollows.authorId }).from(userFollows).innerJoin(users, eq(userFollows.authorId, users.id)).where(and(eq(userFollows.followerId, viewer.id), eq(userFollows.authorId, posts.authorId), eq(users.status, 'active')))) : undefined
      if (followingScope) conditions.push(followingScope)
      if (query.type) {
        conditions.push(eq(posts.type, query.type))
      }

      if (query.q) {
        // Parameterized literal substring search.
        conditions.push(
          query.following ? sql`(LOCATE(${query.q}, ${posts.title}) > 0 OR EXISTS (SELECT 1 FROM users WHERE users.id = ${posts.authorId} AND (LOCATE(${query.q}, users.display_name) > 0 OR LOCATE(${query.q}, users.username) > 0)) OR EXISTS (SELECT 1 FROM post_tags INNER JOIN tags ON tags.id = post_tags.tag_id WHERE post_tags.post_id = ${posts.id} AND LOCATE(${query.q}, tags.name) > 0))` : sql`LOCATE(${query.q}, ${posts.title}) > 0`,
        )
      }

      const selectedSlugs = [...new Set([...(query.tags ?? []), ...(query.tag ? [query.tag] : [])])]
      for (const slug of selectedSlugs) {
        conditions.push(exists(
          tx.select({ postId: postTags.postId })
            .from(postTags)
            .innerJoin(tags, eq(postTags.tagId, tags.id))
            .where(and(
              eq(postTags.postId, posts.id),
              eq(tags.slug, slug),
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
            titleName: userTitles.name,
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
        .innerJoin(userTitles, eq(users.titleId, userTitles.id))
        .leftJoin(recipeDetails, eq(recipeDetails.postId, posts.id))
        .where(filter)
        .orderBy(...(viewer && query.saved ? [desc(sql`(SELECT created_at FROM saved_posts WHERE user_id = ${viewer.id} AND post_id = ${posts.id})`), desc(posts.id)] : [desc(posts.publishedAt), desc(posts.id)]))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit)

      const total = Number(totalRow?.total ?? 0)
      const tagRows = items.length ? await tx.select({ postId: postTags.postId, id: tags.id, name: tags.name, slug: tags.slug })
        .from(postTags).innerJoin(tags, eq(postTags.tagId, tags.id))
        .where(inArray(postTags.postId, items.map(item => item.id))) : []

      // Counts describe the whole current collection, independently of search/tag/page filters.
      const popularTags = await tx.select({ id: tags.id, name: tags.name, slug: tags.slug, postCount: count() })
        .from(tags)
        .innerJoin(postTags, eq(postTags.tagId, tags.id))
        .innerJoin(posts, eq(postTags.postId, posts.id))
        .where(and(eq(posts.status, 'published'), isNull(posts.deletedAt), followingScope, viewer && query.saved ? exists(tx.select({ id: savedPosts.postId }).from(savedPosts).where(and(eq(savedPosts.postId, posts.id), eq(savedPosts.userId, viewer.id)))) : undefined))
        .groupBy(tags.id, tags.name, tags.slug)
        .orderBy(desc(count()), asc(tags.name), asc(tags.id))
        .limit(12)
      const selectedTags = selectedSlugs.length ? await tx.select({ id: tags.id, name: tags.name, slug: tags.slug }).from(tags).where(inArray(tags.slug, selectedSlugs)) : []
      const selectedTag = selectedTags.find(tag => tag.slug === query.tag) ?? null

      return {
        popularTags: popularTags.map(tag => ({ ...tag, postCount: Number(tag.postCount) })),
        selectedTag,
        selectedTags,
        posts: items.map(item => ({
          ...item,
          tags: tagRows.filter(tag => tag.postId === item.id).map(({ id, name, slug }) => ({ id, name, slug })),
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

export const POST=measureApi("/api/posts","POST",POSTHandler)

export const GET=measureApi("/api/posts","GET",GETHandler)

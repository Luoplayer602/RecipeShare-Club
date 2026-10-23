import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { mediaAssets, posts, users, userTitles } from '@/db/schema'
import { postIdSchema } from '@/lib/posts/post-id'
import { loadPostContent } from '@/lib/posts/load-content'

const headers = { 'Cache-Control': 'no-store' }

type Context = {
  params: Promise<{ id: string }>
}

function respond(body: unknown, status: number) {
  return Response.json(body, { status, headers })
}

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params
    const parsedId = postIdSchema.safeParse(id)

    if (!parsedId.success) {
      return respond({ code: 'INVALID_POST_ID' }, 400)
    }

    const result = await db.transaction(async tx => {
      const [post] = await tx
        .select({
          id: posts.id,
          type: posts.type,
          title: posts.title,
          slug: posts.slug,
          excerpt: posts.excerpt,
          coverMediaId: posts.coverMediaId,
          publishedAt: posts.publishedAt,
          updatedAt: posts.updatedAt,
          author: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            titleName: userTitles.name,
            avatarUrl: users.avatarUrl,
          },
        })
        .from(posts)
        .innerJoin(users, eq(posts.authorId, users.id))
        .innerJoin(userTitles, eq(users.titleId, userTitles.id))
        .where(and(
          eq(posts.id, parsedId.data),
          eq(posts.status, 'published'),
          isNull(posts.deletedAt),
        ))
        .limit(1)

      if (!post) return null

      const content = await loadPostContent(tx, post.id, post.type)
      const mediaIds = new Set<string>()

      if (post.coverMediaId) {
        mediaIds.add(post.coverMediaId)
      }

      for (const block of content.blocks) {
        if (block.data.type === 'image' || block.data.type === 'video') {
          mediaIds.add(block.data.mediaId)
        }
      }

      const assets = mediaIds.size === 0
        ? []
        : await tx
            .select({
              id: mediaAssets.id,
              kind: mediaAssets.kind,
              source: mediaAssets.source,
              externalUrl: mediaAssets.externalUrl,
              mimeType: mediaAssets.mimeType,
            })
            .from(mediaAssets)
            .where(inArray(mediaAssets.id, [...mediaIds]))

      const media = assets.map(asset => ({
        id: asset.id,
        kind: asset.kind,
        source: asset.source,
        mimeType: asset.mimeType,
        url: asset.source === 'upload'
          ? `/api/media/${asset.id}/file`
          : asset.externalUrl,
      }))

      return {
        ...post,
        ...content,
        media,
      }
    }, {
      isolationLevel: 'repeatable read',
      accessMode: 'read only',
    })

    if (!result) {
      return respond({ code: 'POST_NOT_FOUND' }, 404)
    }

    return respond({ post: result }, 200)
  } catch {
    console.error('[posts/public] Read failed.')
    return respond({ code: 'POST_READ_UNAVAILABLE' }, 503)
  }
}
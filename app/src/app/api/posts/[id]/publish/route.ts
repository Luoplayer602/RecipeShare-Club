import { getSessionUser } from '@/lib/auth/session'
import { postIdSchema } from '@/lib/posts/post-id'
import { publishPost } from '@/lib/posts/publish-post'
import { hasInvalidOrigin } from '@/lib/posts/request'

const headers = { 'Cache-Control': 'no-store' }

type Context = {
  params: Promise<{ id: string }>
}

function respond(body: unknown, status: number) {
  return Response.json(body, { status, headers })
}

export async function POST(request: Request, context: Context) {
  if (hasInvalidOrigin(request)) {
    return respond({ code: 'INVALID_ORIGIN' }, 403)
  }

  try {
    const user = await getSessionUser()

    if (!user) {
      return respond({ code: 'UNAUTHENTICATED' }, 401)
    }

    const { id } = await context.params
    const parsedId = postIdSchema.safeParse(id)

    if (!parsedId.success) {
      return respond({ code: 'INVALID_POST_ID' }, 400)
    }

    // Publish only the content already saved in the database.
    const result = await publishPost(parsedId.data, user.id)

    if (!result.ok) {
      return respond({
        code: result.code,
        ...(result.issues ? { issues: result.issues } : {}),
      }, result.status)
    }

    return respond({
      message: 'Post published.',
      post: {
        id: result.postId,
        slug: result.slug,
        version: result.version,
        publishedAt: result.publishedAt,
      },
    }, 200)
  } catch {
    console.error('[posts/publish] Publication failed.')
    return respond({ code: 'POST_PUBLISH_UNAVAILABLE' }, 503)
  }
}
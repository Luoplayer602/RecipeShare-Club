import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { posts, savedPosts } from '@/db/schema'
import { getSessionUser } from '@/lib/auth/session'

const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
type Context = { params: Promise<{ id: string }> }
async function handle(request: Request, context: Context, mutation?: 'save' | 'remove') {
  if (mutation && (request.headers.get('sec-fetch-site') === 'cross-site' || (request.headers.get('origin') !== null && request.headers.get('origin') !== new URL(request.url).origin))) return respond({ code: 'INVALID_ORIGIN' }, 403)
  const { id } = await context.params
  if (!z.uuid().safeParse(id).success) return respond({ code: 'INVALID_ID' }, 400)
  try {
    const user = await getSessionUser()
    if (!user) return respond({ code: 'UNAUTHENTICATED' }, 401)
    const condition = and(eq(savedPosts.userId, user.id), eq(savedPosts.postId, id))
    if (mutation === 'remove') {
      await db.delete(savedPosts).where(condition)
      return respond({ saved: false })
    }
    const [post] = await db.select({ id: posts.id }).from(posts).where(and(eq(posts.id, id), eq(posts.status, 'published'), isNull(posts.deletedAt))).limit(1)
    if (!post) return respond({ code: 'NOT_FOUND' }, 404)
    if (mutation === 'save') {
      await db.insert(savedPosts).values({ userId: user.id, postId: id }).onDuplicateKeyUpdate({ set: { postId: id } })
      return respond({ saved: true })
    }
    const [saved] = await db.select({ id: savedPosts.postId }).from(savedPosts).where(condition).limit(1)
    return respond({ saved: Boolean(saved) })
  } catch { return respond({ code: 'SAVE_UNAVAILABLE' }, 503) }
}
export const GET = (request: Request, context: Context) => handle(request, context)
export const PUT = (request: Request, context: Context) => handle(request, context, 'save')
export const DELETE = (request: Request, context: Context) => handle(request, context, 'remove')

import {measureApi} from '@/lib/monitoring/metrics'
import { hasInvalidOrigin } from '@/lib/http/origin'
import { and, count, eq } from 'drizzle-orm'
import { db } from '@/db'
import { users, userFollows } from '@/db/schema'
import { getSessionUser } from '@/lib/auth/session'
import { profileUsername } from '@/lib/profiles/validation'

const respond = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
type Context = { params: Promise<{ username: string }> }
async function handle(request: Request, context: Context, mutation?: 'follow' | 'remove') {
  if (mutation && hasInvalidOrigin(request)) return respond({ code: 'INVALID_ORIGIN' }, 403)
  const parsed = profileUsername.safeParse((await context.params).username)
  if (!parsed.success) return respond({ code: 'INVALID_USERNAME' }, 400)
  try {
    const viewer = await getSessionUser()
    if (mutation && !viewer) return respond({ code: 'UNAUTHENTICATED' }, 401)
    const [author] = await db.select({ id: users.id }).from(users).where(and(eq(users.username, parsed.data), eq(users.status, 'active'))).limit(1)
    if (!author) return respond({ code: 'PROFILE_NOT_FOUND' }, 404)
    const own = viewer?.id === author.id
    if (mutation && own) return respond({ code: 'CANNOT_FOLLOW_SELF' }, 400)
    const condition = and(eq(userFollows.followerId, viewer?.id ?? ''), eq(userFollows.authorId, author.id))
    if (mutation === 'follow') await db.insert(userFollows).values({ followerId: viewer!.id, authorId: author.id }).onDuplicateKeyUpdate({ set: { authorId: author.id } })
    if (mutation === 'remove') await db.delete(userFollows).where(condition)
    const [followers] = await db.select({ total: count() }).from(userFollows).innerJoin(users, eq(userFollows.followerId, users.id)).where(and(eq(userFollows.authorId, author.id), eq(users.status, 'active')))
    const [following] = await db.select({ total: count() }).from(userFollows).innerJoin(users, eq(userFollows.authorId, users.id)).where(and(eq(userFollows.followerId, author.id), eq(users.status, 'active')))
    const [relation] = viewer && !own ? await db.select({ id: userFollows.authorId }).from(userFollows).where(condition).limit(1) : []
    return respond({ following: Boolean(relation), followerCount: Number(followers.total), followingCount: Number(following.total), own, authenticated: Boolean(viewer) })
  } catch { return respond({ code: 'FOLLOW_UNAVAILABLE' }, 503) }
}
export const GET = measureApi("/api/profiles/[username]/follow","GET",(request: Request, context: Context) => handle(request, context))
export const PUT = measureApi("/api/profiles/[username]/follow","PUT",(request: Request, context: Context) => handle(request, context, 'follow'))
export const DELETE = measureApi("/api/profiles/[username]/follow","DELETE",(request: Request, context: Context) => handle(request, context, 'remove'))

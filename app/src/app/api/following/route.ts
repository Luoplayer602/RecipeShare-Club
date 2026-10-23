import { and, asc, count, desc, eq, exists, isNull, ne, not, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { users, userTitles, posts, userFollows } from '@/db/schema'
import { getSessionUser } from '@/lib/auth/session'
const querySchema = z.strictObject({ q: z.string().trim().max(100).default(''), page: z.coerce.number().int().min(1).max(10000).default(1) })
const headers = { 'Cache-Control': 'private, no-store' }
export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return Response.json({ code: 'INVALID_QUERY' }, { status: 400, headers })
  try {
    const viewer = await getSessionUser()
    if (!viewer) return Response.json({ code: 'UNAUTHENTICATED' }, { status: 401, headers })
    const { q, page } = parsed.data
    const result = await db.transaction(async tx => {
      const relation = and(eq(userFollows.followerId, viewer.id), eq(users.status, 'active'))
      const filter = and(relation, q ? sql`(LOCATE(${q}, ${users.displayName}) > 0 OR LOCATE(${q}, ${users.username}) > 0)` : undefined)
      const [all] = await tx.select({ total: count() }).from(userFollows).innerJoin(users, eq(userFollows.authorId, users.id)).where(relation)
      const [matched] = await tx.select({ total: count() }).from(userFollows).innerJoin(users, eq(userFollows.authorId, users.id)).where(filter)
      const postCount = sql<number>`(SELECT COUNT(*) FROM posts WHERE author_id = ${users.id} AND status = 'published' AND deleted_at IS NULL)`
      const followerCount = sql<number>`(SELECT COUNT(*) FROM user_follows INNER JOIN users AS follower ON follower.id = user_follows.follower_id WHERE user_follows.author_id = ${users.id} AND follower.status = 'active')`
      const fields = { id: users.id, username: users.username, displayName: users.displayName, avatarUrl: users.avatarUrl, titleName: userTitles.name, postCount, followerCount }
      const authors = await tx.select(fields).from(userFollows).innerJoin(users, eq(userFollows.authorId, users.id)).innerJoin(userTitles, eq(users.titleId, userTitles.id)).where(filter).orderBy(desc(userFollows.createdAt), asc(users.id)).limit(5).offset((page - 1) * 5)
      const suggestions = await tx.select(fields).from(users).innerJoin(userTitles, eq(users.titleId, userTitles.id)).where(and(eq(users.status, 'active'), ne(users.id, viewer.id), not(exists(tx.select({ id: userFollows.authorId }).from(userFollows).where(and(eq(userFollows.followerId, viewer.id), eq(userFollows.authorId, users.id))))), exists(tx.select({ id: posts.id }).from(posts).where(and(eq(posts.authorId, users.id), eq(posts.status, 'published'), isNull(posts.deletedAt)))))).orderBy(desc(postCount), asc(users.id)).limit(6)
      const total = Number(matched.total)
      return { totalFollowing: Number(all.total), authors: authors.map(item => ({ ...item, postCount: Number(item.postCount), followerCount: Number(item.followerCount) })), suggestions: suggestions.map(item => ({ ...item, postCount: Number(item.postCount), followerCount: Number(item.followerCount) })), pagination: { page, total, totalPages: Math.ceil(total / 5) } }
    }, { isolationLevel: 'repeatable read', accessMode: 'read only' })
    return Response.json(result, { headers })
  } catch { return Response.json({ code: 'FOLLOWING_UNAVAILABLE' }, { status: 503, headers }) }
}

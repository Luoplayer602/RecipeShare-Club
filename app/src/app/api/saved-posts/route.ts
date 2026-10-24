import {measureApi} from '@/lib/monitoring/metrics'
import { and, count, eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { posts, savedPosts } from '@/db/schema'
import { getSessionUser } from '@/lib/auth/session'
async function GETHandler() {
  const headers = { 'Cache-Control': 'no-store' }
  try {
    const user = await getSessionUser()
    if (!user) return Response.json({ code: 'UNAUTHENTICATED' }, { status: 401, headers })
    const [row] = await db.select({ total: count() }).from(savedPosts).innerJoin(posts, eq(savedPosts.postId, posts.id)).where(and(eq(savedPosts.userId, user.id), eq(posts.status, 'published'), isNull(posts.deletedAt)))
    return Response.json({ total: Number(row.total) }, { headers })
  } catch { return Response.json({ code: 'SAVED_POSTS_UNAVAILABLE' }, { status: 503, headers }) }
}

export const GET=measureApi("/api/saved-posts","GET",GETHandler)

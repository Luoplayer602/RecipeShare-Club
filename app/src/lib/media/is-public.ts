import 'server-only'

import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { posts, postBlocks, users, userProfiles } from '@/db/schema'

export async function isMediaPublic(mediaId: string): Promise<boolean> {
  const [profileReference] = await db.select({id:userProfiles.userId}).from(userProfiles)
    .innerJoin(users,eq(users.id,userProfiles.userId))
    .where(and(eq(users.status,'active'),or(eq(userProfiles.coverMediaId,mediaId),eq(userProfiles.avatarMediaId,mediaId)))).limit(1)
  if (profileReference) return true

  const [coverReference] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(
      eq(posts.coverMediaId, mediaId),
      eq(posts.status, 'published'),
      isNull(posts.deletedAt),
    ))
    .limit(1)

  if (coverReference) return true

  const [blockReference] = await db
    .select({ id: postBlocks.id })
    .from(postBlocks)
    .innerJoin(posts, eq(postBlocks.postId, posts.id))
    .where(and(
      eq(posts.status, 'published'),
      isNull(posts.deletedAt),
      sql`JSON_UNQUOTE(
        JSON_EXTRACT(${postBlocks.data}, '$.mediaId')
      ) = ${mediaId}`,
      sql`JSON_UNQUOTE(
        JSON_EXTRACT(${postBlocks.data}, '$.type')
      ) IN ('image', 'video')`,
    ))
    .limit(1)

  return Boolean(blockReference)
}
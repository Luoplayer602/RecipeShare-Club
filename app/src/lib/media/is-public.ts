import 'server-only'

import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { posts, postBlocks } from '@/db/schema'

export async function isMediaPublic(mediaId: string): Promise<boolean> {
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
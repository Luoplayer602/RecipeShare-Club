import { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { userFollows, users, userTitles, userProfiles, posts, recipeDetails, postTags, tags } from '@/db/schema'
import { getSessionUser } from '@/lib/auth/session'
import { profileUsername, profileQuery } from '@/lib/profiles/validation'
const headers = { 'Cache-Control': 'private, no-store' }
export async function GET(request: Request, context: { params: Promise<{ username: string }> }) {
  const username = profileUsername.safeParse((await context.params).username)
  const query = profileQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!username.success || !query.success) return Response.json({ code: 'INVALID_QUERY' }, { status:400, headers })
  try {
    const viewer = await getSessionUser()
    const result = await db.transaction(async tx => {
      const [profile] = await tx.select({ id:users.id, username:users.username, displayName:users.displayName, titleName:userTitles.name,
        avatarUrl:users.avatarUrl, bio:userProfiles.bio, location:userProfiles.location, coverMediaId:userProfiles.coverMediaId, avatarMediaId:userProfiles.avatarMediaId, coverY:userProfiles.coverY,
      }).from(users).innerJoin(userTitles,eq(users.titleId,userTitles.id)).leftJoin(userProfiles,eq(userProfiles.userId,users.id))
        .where(and(eq(users.username,username.data),eq(users.status,'active'))).limit(1)
      if (!profile) return { status:404, body:{code:'PROFILE_NOT_FOUND'} }
      const own = viewer?.id === profile.id
      if (query.data.tab === 'drafts' && !own) return { status:403, body:{code:'FORBIDDEN'} }
      const scope = and(eq(posts.authorId,profile.id),isNull(posts.deletedAt))
      const stats = await tx.select({ status:posts.status, total:count() }).from(posts).where(scope).groupBy(posts.status)
      const publishedCount = Number(stats.find(row=>row.status==='published')?.total ?? 0)
      const draftCount = own ? Number(stats.find(row=>row.status==='draft')?.total ?? 0) : null
      const [followers] = await tx.select({ total:count() }).from(userFollows).innerJoin(users,eq(userFollows.followerId,users.id)).where(and(eq(userFollows.authorId,profile.id),eq(users.status,'active')))
      const [following] = await tx.select({ total:count() }).from(userFollows).innerJoin(users,eq(userFollows.authorId,users.id)).where(and(eq(userFollows.followerId,profile.id),eq(users.status,'active')))
      const filter = and(scope,eq(posts.status,query.data.tab==='drafts'?'draft':'published'),query.data.q ? sql`LOCATE(${query.data.q}, ${posts.title}) > 0` : undefined)
      const [total] = await tx.select({ value:count() }).from(posts).where(filter)
      const items = await tx.select({ id:posts.id, type:posts.type, title:posts.title, slug:posts.slug, excerpt:posts.excerpt,
        coverMediaId:posts.coverMediaId, publishedAt:posts.publishedAt, updatedAt:posts.updatedAt,
        recipe:{prepMinutes:recipeDetails.prepMinutes,cookMinutes:recipeDetails.cookMinutes,servings:recipeDetails.servings,difficulty:recipeDetails.difficulty},
      }).from(posts).leftJoin(recipeDetails,eq(recipeDetails.postId,posts.id)).where(filter)
        .orderBy(desc(posts.updatedAt),desc(posts.id)).limit(10).offset((query.data.page-1)*10)
      const tagRows = items.length ? await tx.select({postId:postTags.postId,id:tags.id,name:tags.name,slug:tags.slug}).from(postTags)
        .innerJoin(tags,eq(tags.id,postTags.tagId)).where(inArray(postTags.postId,items.map(item=>item.id))).orderBy(asc(tags.name)) : []
      const countValue = Number(total.value)
      return { status:200, body:{ own, profile:{...profile,bio:profile.bio??'',location:profile.location??'',coverY:profile.coverY??50,coverUrl:profile.coverMediaId?`/api/media/${profile.coverMediaId}/file`:null},
        stats:{publishedCount,draftCount,followerCount:Number(followers.total),followingCount:Number(following.total)}, items:items.map(item=>({...item,recipe:item.type==='recipe'?item.recipe:null,
          coverUrl:item.coverMediaId?`/api/media/${item.coverMediaId}/file`:null,
          author:{id:profile.id,username:profile.username,displayName:profile.displayName,titleName:profile.titleName,avatarUrl:profile.avatarUrl},
          tags:tagRows.filter(tag=>tag.postId===item.id).map(({id,name,slug})=>({id,name,slug})),
        })), pagination:{page:query.data.page,limit:10,total:countValue,totalPages:Math.ceil(countValue/10),hasNext:query.data.page*10<countValue},
      } }
    },{isolationLevel:'repeatable read',accessMode:'read only'})
    return Response.json(result.body,{status:result.status,headers})
  } catch { console.error('[profile/read] Failed'); return Response.json({code:'PROFILE_UNAVAILABLE'},{status:503,headers}) }
}

import {measureApi} from '@/lib/monitoring/metrics'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { users, userProfiles, mediaAssets } from '@/db/schema'
import { getSessionUser } from '@/lib/auth/session'
import { updateProfileSchema } from '@/lib/profiles/validation'
import { hasInvalidOrigin, readEditorJson } from '@/lib/posts/request'
const headers = { 'Cache-Control':'no-store' }
const respond = (body:unknown,status:number) => Response.json(body,{status,headers})
async function PATCHHandler(request:Request) {
  if (hasInvalidOrigin(request)) return respond({code:'INVALID_ORIGIN'},403)
  try {
    const user = await getSessionUser()
    if (!user) return respond({code:'UNAUTHENTICATED'},401)
    const body = await readEditorJson(request)
    if (!body.ok) return respond({code:body.code},body.status)
    const parsed = updateProfileSchema.safeParse(body.body)
    if (!parsed.success) return respond({code:'VALIDATION_ERROR'},422)
    const {displayName,...input} = parsed.data
    const result = await db.transaction(async tx=>{
      await tx.select({id:users.id}).from(users).where(eq(users.id,user.id)).limit(1).for('update')
      const ids = [...new Set([input.coverMediaId,input.avatarMediaId,input.imageEdits?.cover?.originalId,input.imageEdits?.avatar?.originalId].filter((id):id is string=>Boolean(id)))]
      if (ids.length) {
        const owned = await tx.select({id:mediaAssets.id}).from(mediaAssets).where(and(inArray(mediaAssets.id,ids),eq(mediaAssets.ownerId,user.id),eq(mediaAssets.kind,'image'),eq(mediaAssets.source,'upload')))
        if (owned.length!==ids.length) return false
      }
      await tx.insert(userProfiles).values({userId:user.id,...input}).onDuplicateKeyUpdate({set:input})
      await tx.update(users).set({displayName,avatarUrl:input.avatarMediaId?`/api/media/${input.avatarMediaId}/file`:null}).where(eq(users.id,user.id))
      return true
    })
    return result ? respond({message:'Profile saved.'},200) : respond({code:'INVALID_PROFILE_MEDIA'},422)
  } catch { console.error('[profile/update] Failed');return respond({code:'PROFILE_UPDATE_UNAVAILABLE'},503) }
}

export const PATCH=measureApi("/api/profile","PATCH",PATCHHandler)

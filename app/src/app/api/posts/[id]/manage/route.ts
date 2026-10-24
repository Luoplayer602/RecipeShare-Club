import {measureApi} from '@/lib/monitoring/metrics'
import {and,eq,isNull} from 'drizzle-orm'
import {z} from 'zod'
import {db} from '@/db'
import {posts,postEdits} from '@/db/schema'
import {getSessionUser} from '@/lib/auth/session'
import {hasInvalidOrigin,readEditorJson} from '@/lib/posts/request'
import {postIdSchema} from '@/lib/posts/post-id'
import {saveDraft} from '@/lib/posts/save-draft'
const respond=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}})
async function PATCHHandler(request:Request,context:{params:Promise<{id:string}>}){
  if(hasInvalidOrigin(request))return respond({code:'INVALID_ORIGIN'},403)
  try{
    const user=await getSessionUser();if(!user)return respond({code:'UNAUTHENTICATED'},401)
    const id=postIdSchema.safeParse((await context.params).id);if(!id.success)return respond({code:'INVALID_POST_ID'},400)
    const body=await readEditorJson(request);if(!body.ok)return respond({code:body.code},body.status)
    const input=z.strictObject({action:z.enum(['unpublish','delete'])}).safeParse(body.body);if(!input.success)return respond({code:'VALIDATION_ERROR'},422)
    const result=await db.transaction(async tx=>{
      const [post]=await tx.select().from(posts).where(and(eq(posts.id,id.data),eq(posts.authorId,user.id),isNull(posts.deletedAt))).limit(1).for('update')
      if(!post)return {code:'POST_NOT_FOUND',status:404}
      if(input.data.action==='delete'){
        await tx.update(posts).set({deletedAt:new Date(),updatedAt:new Date()}).where(eq(posts.id,id.data))
        await tx.delete(postEdits).where(eq(postEdits.postId,id.data));return {status:200}
      }
      if(post.status!=='published')return {code:'POST_NOT_PUBLISHED',status:409}
      const [edit]=await tx.select().from(postEdits).where(eq(postEdits.postId,id.data)).limit(1)
      if(edit){const applied=await saveDraft(id.data,user.id,edit.content,tx,true);if(!applied.ok)return {code:applied.code,status:applied.status}}
      await tx.update(posts).set({status:'draft',updatedAt:new Date()}).where(eq(posts.id,id.data))
      await tx.delete(postEdits).where(eq(postEdits.postId,id.data));return {status:200}
    })
    return respond(result,result.status)
  }catch{return respond({code:'POST_MANAGEMENT_UNAVAILABLE'},503)}
}

export const PATCH=measureApi("/api/posts/[id]/manage","PATCH",PATCHHandler)

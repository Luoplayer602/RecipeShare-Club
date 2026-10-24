import {and,asc,count,eq,sql} from 'drizzle-orm'
import {z} from 'zod'
import {db} from '@/db'
import {users,userTitles} from '@/db/schema'
import {parseSearch} from '@/lib/posts/search'
import {measureApi} from '@/lib/monitoring/metrics'

const schema=z.strictObject({q:z.string().trim().min(1).max(300)})
const headers={'Cache-Control':'no-store'}
async function GETHandler(request:Request){
  const parsed=schema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if(!parsed.success)return Response.json({code:'INVALID_QUERY'},{status:400,headers})
  const search=parseSearch(parsed.data.q)
  if(!search.valid || !search.peopleOnly)return Response.json({code:'INVALID_QUERY'},{status:400,headers})
  if(search.incomplete || !search.authors.length)return Response.json({users:[],total:0},{headers})
  try{
    const result=await db.transaction(async tx=>{
      const filter=and(eq(users.status,'active'),...search.authors.map(term=>sql`LOCATE(${term.toLowerCase()}, ${users.username}) > 0`))
      const [row]=await tx.select({total:count()}).from(users).where(filter)
      const matches=await tx.select({id:users.id,username:users.username,displayName:users.displayName,avatarUrl:users.avatarUrl,titleName:userTitles.name}).from(users).innerJoin(userTitles,eq(users.titleId,userTitles.id)).where(filter).orderBy(asc(users.username),asc(users.id)).limit(8)
      return {users:matches,total:Number(row.total)}
    },{isolationLevel:'repeatable read',accessMode:'read only'})
    return Response.json(result,{headers})
  }catch{return Response.json({code:'PROFILE_SEARCH_UNAVAILABLE'},{status:503,headers})}
}
export const GET=measureApi('/api/profiles','GET',GETHandler)

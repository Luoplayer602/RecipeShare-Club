// Isolated fixtures; works through the existing local Nginx with real sessions/DB.
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
dotenv.config({path:new URL('../.env.local',import.meta.url),quiet:true})
const base=process.env.TEST_BASE_URL||'http://localhost:8080'
const db=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD})
const suffix=randomBytes(6).toString('hex'),username='qasearch_'+suffix,password=randomBytes(24).toString('base64url')
let userId,cookie=''
const ids=[],tagIds=[]
async function request(path,method='GET',body){
  const response=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json',Origin:new URL(base).origin}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(120000)})
  const data=await response.json()
  assert.ok(response.ok,path+': '+(data.code||response.status))
  if(path==='/api/auth/login')cookie=response.headers.get('set-cookie').split(';')[0]
  return data
}
const search=q=>request('/api/posts?'+new URLSearchParams({q}))
try{
  userId=(await request('/api/auth/register','POST',{username,password,displayName:'Search QA',email:username+'@example.invalid'})).user.id
  await request('/api/auth/login','POST',{identifier:username,password})
  for(let i=0;i<3;i++){
    const id=randomUUID();ids.push(id)
    await db.execute('INSERT INTO posts (id,author_id,type,title,slug,excerpt,status,published_at) VALUES (?,?,?,?,?,?,?,NOW(3))',[id,userId,'recipe','Canh '+suffix+' '+i,'search-'+id,'Search fixture',i===2?'draft':'published'])
    await db.execute('INSERT INTO recipe_details (post_id,prep_minutes,cook_minutes,servings,difficulty) VALUES (?,1,2,2,1)',[id])
    await db.execute('INSERT INTO recipe_ingredients (id,post_id,name,quantity,position) VALUES (?,?,?,?,0)',[randomUUID(),id,i===1?'Đậu phụ':'Nấm hương '+suffix,'1'])
  }
  for(const name of ['Món chay '+suffix,'Bữa tối '+suffix]){
    const id=randomUUID();tagIds.push(id)
    await db.execute('INSERT INTO tags (id,name,slug,created_by) VALUES (?,?,?,?)',[id,name,'search-'+id,userId])
  }
  for(const [post,tag] of [[ids[0],tagIds[0]],[ids[0],tagIds[1]],[ids[1],tagIds[0]],[ids[2],tagIds[0]]])await db.execute('INSERT INTO post_tags (post_id,tag_id) VALUES (?,?)',[post,tag])
  assert.deepEqual((await search('@'+username+' #Món chay '+suffix+' %Nấm hương '+suffix)).posts.map(post=>post.id),[ids[0]])
  assert.deepEqual((await search('#Món chay '+suffix+' #Bữa tối '+suffix)).posts.map(post=>post.id),[ids[0]])
  assert.equal((await search('@'+username+' %Đậu phụ')).posts[0].id,ids[1])
  assert.equal((await search('%Nấm hương '+suffix)).posts.length,1)
  assert.equal((await search('#not_existing_'+suffix)).posts.length,0)
  assert.equal((await search('#Món chay '+suffix+' %')).posts.length,0)
  assert.equal((await search("%x' OR 1=1 -- "+suffix)).posts.length,0)
  const profiles=await request('/api/profiles?'+new URLSearchParams({q:'@'+username}))
  assert.equal(profiles.total,1);assert.equal(profiles.users[0].username,username)
  assert.deepEqual(Object.keys(profiles.users[0]).sort(),['avatarUrl','displayName','id','titleName','username'])
  await db.execute('UPDATE users SET status = ? WHERE id = ?',['suspended',userId])
  assert.equal((await request('/api/profiles?'+new URLSearchParams({q:'@'+username}))).total,0)
  assert.equal((await search('@'+username+' #Món chay '+suffix)).posts.length,0)
  console.log('PASS: combined AND search, categories, multiword ingredients, private draft exclusion, literal SQL parameters and public username search without contact details/suspended accounts.')
}finally{
  if(userId){
    for(const id of ids)await db.execute('DELETE FROM posts WHERE id = ? AND author_id = ?',[id,userId])
    for(const id of tagIds)await db.execute('DELETE FROM tags WHERE id = ? AND created_by = ?',[id,userId])
    await db.execute('DELETE FROM users WHERE id = ? AND username = ?',[userId,username])
  }
  await db.end()
  console.log('Isolated search fixtures cleaned up.')
}

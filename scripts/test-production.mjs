// Run against a separately named, already bootstrapped Compose deployment.
// TLS verification uses the exact local certificate; verification is never disabled.
import fs from 'node:fs'
import https from 'node:https'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {createRequire} from 'node:module'
import {execFileSync} from 'node:child_process'
const require=createRequire(new URL('../app/package.json',import.meta.url)),dotenv=require('dotenv'),mysql=require('mysql2/promise')
const envFile=process.argv[2]
if(!envFile)throw Error('Usage: node scripts/test-production.mjs <isolated-compose.env>')
const config=dotenv.parse(fs.readFileSync(envFile))
if(!config.COMPOSE_PROJECT_NAME?.startsWith('recipeshare-clean-'))throw Error('Use a separately named recipeshare-clean-* project for this integration test.')
const root=new URL('..',import.meta.url)
const compose=['compose','--env-file',envFile,'-f','compose.yaml','-f','compose.production.yaml']
const base=`https://localhost:${config.HTTPS_PORT||8443}`
const agent=new https.Agent({ca:fs.readFileSync(new URL('../.secrets/tls/localhost.crt',import.meta.url))})
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const suffix=randomBytes(6).toString('hex'),username='qaprod_'+suffix,password=randomBytes(24).toString('base64url')
let userId,cookie='',postId,mediaId
async function request(route,method='GET',body,expected=200,authenticated=true,origin=base){
  const form=body instanceof FormData
  const headers={...(authenticated&&cookie?{Cookie:cookie}:{}),...(method!=='GET'?{Origin:origin}:{}),...(body&&!form?{'Content-Type':'application/json'}:{})}
  const outbound=new Request(base+route,{method,headers,body:body?(form?body:JSON.stringify(body)):undefined})
  const payload=body?Buffer.from(await outbound.arrayBuffer()):undefined
  const response=await new Promise((resolve,reject)=>{
    const req=https.request(base+route,{method,agent,headers:Object.fromEntries(outbound.headers)},res=>{
      const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text:Buffer.concat(chunks).toString()}))
    })
    req.setTimeout(30000,()=>req.destroy(Error('HTTPS request timed out')))
    req.on('error',reject);req.end(payload)
  })
  assert.equal(response.status,expected,method+' '+route+' returned '+response.status)
  const data=response.text.startsWith('{')?JSON.parse(response.text):null
  if(route==='/api/auth/login'&&expected===200){
    const value=response.headers['set-cookie']?.[0]||''
    assert.ok(/; Secure/i.test(value),'Production session must be Secure')
    assert.ok(/; HttpOnly/i.test(value),'Production session must be HttpOnly')
    assert.ok(/; SameSite=Lax/i.test(value),'Production session must use SameSite=Lax')
    cookie=value.split(';')[0]
  }
  return {data,...response}
}
function docker(args){return execFileSync('docker',[...compose,...args],{cwd:root,encoding:'utf8',stdio:'pipe'})}
async function ready(){
  for(let attempt=0;attempt<60;attempt++){
    try{if((await request('/api/health/db')).data.database==='connected')return}catch{}
    await pause(1000)
  }
  throw Error('Application did not become ready after restart')
}
try{
  await ready()
  const databaseTool=await fetch(`http://localhost:${config.PHPMYADMIN_PORT||8081}`)
  assert.ok(databaseTool.ok,'phpMyAdmin must be reachable')
  const redirect=await fetch(`http://localhost:${config.WEB_PORT||8080}/home`,{redirect:'manual'})
  assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),base+'/home')
  await request('/api/metrics','GET',undefined,404,false)
  const home=await request('/home')
  assert.equal(home.headers['x-content-type-options'],'nosniff')
  assert.ok(home.text.includes('RecipeShare'))
  const registered=await request('/api/auth/register','POST',{username,displayName:'Production integration',email:username+'@example.invalid',password},201)
  userId=registered.data.user.id
  await request('/api/auth/login','POST',{identifier:username,password})
  assert.equal((await request('/api/auth/me')).data.user.id,userId)
  const form=new FormData()
  // A complete, detected PNG fixture; no reliance on a remote image service.
  form.set('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64')],{type:'image/png'}),'fixture.png')
  mediaId=(await request('/api/media/upload','POST',form,201)).data.media.id
  postId=(await request('/api/posts','POST',{type:'recipe',title:'Docker recipe '+suffix,excerpt:'Production persistence check'},201)).data.post.id
  const content={title:'Docker recipe '+suffix,excerpt:'Production persistence check',coverMediaId:mediaId,recipe:{prepMinutes:1,cookMinutes:2,servings:2,difficulty:1,ingredients:[{name:'Nấm hương '+suffix,quantity:'1/2',unit:'kg',note:'Rửa sạch'}]},blocks:[{type:'paragraph',text:'Nấu và thưởng thức.'}],tagNames:['Món chay '+suffix]}
  await request('/api/posts/'+postId+'/edit','PATCH',content,403,true,'https://evil.invalid')
  await request('/api/posts/'+postId+'/edit','PATCH',content)
  await request('/api/posts/'+postId,'GET',undefined,404,false)
  await request('/api/posts/'+postId+'/publish','POST')
  assert.equal((await request('/api/posts/'+postId,'GET',undefined,200,false)).data.post.recipe.ingredients[0].quantity,'1/2')
  const q='@'+username+' #Món chay '+suffix+' %Nấm hương '+suffix
  const found=(await request('/api/posts?'+new URLSearchParams({q}),'GET',undefined,200,false)).data
  assert.ok(found.posts.some(post=>post.id===postId))
  console.log('PASS: trusted self-signed HTTPS, HTTP redirect, Secure/HttpOnly session, origin guard, image upload, recipe publication and combined search.')

  const appId=docker(['ps','-q','app']).trim()
  const [container]=JSON.parse(execFileSync('docker',['inspect',appId],{encoding:'utf8',stdio:'pipe'}))
  assert.equal(container.Config.User,'node')
  assert.equal(container.HostConfig.ReadonlyRootfs,true)
  assert.equal(Object.keys(container.HostConfig.PortBindings||{}).length,0)
  docker(['exec','-T','app','node','-e',"const fs=require('fs');for(const p of ['/app/.env.local','/app/.env.migration.local','/app/src','/app/.uploads','/app/.secrets'])if(fs.existsSync(p))throw Error('Unexpected packaged file: '+p);console.log('Standalone image excludes workspace credentials and uploads.')"])
  docker(['restart','mysql'])
  await ready()
  docker(['up','-d','--no-deps','--force-recreate','--wait','app'])
  docker(['restart','nginx'])
  await ready()
  assert.equal((await request('/api/auth/me')).data.user.id,userId)
  assert.equal((await request('/api/posts/'+postId,'GET',undefined,200,false)).data.post.title,content.title)
  const image=await request('/api/media/'+mediaId+'/file','GET',undefined,200,false)
  assert.equal(image.headers['content-type'],'image/png')
  console.log('PASS: non-root standalone image without local credentials/source/uploads; DB, session, recipe and uploaded image survive MySQL restart and app recreation.')

  const prom=`http://localhost:${config.PROMETHEUS_PORT||9090}`
  for(let attempt=0;attempt<30;attempt++){
    const targets=(await (await fetch(prom+'/api/v1/targets')).json()).data.activeTargets
    if(['prometheus','nginx','recipeshare','grafana','loki','alloy','promtail','mysql','containers'].every(job=>targets.some(target=>target.labels.job===job&&target.health==='up'))){
      assert.ok(targets.some(target=>target.labels.job==='recipeshare'&&target.scrapeUrl==='http://app:3000/api/metrics'));break
    }
    if(attempt===29)throw Error('Production scrape targets did not all become healthy')
    await pause(2000)
  }
  const grafana=`http://localhost:${config.GRAFANA_PORT||3002}`
  const grafanaPassword=fs.readFileSync(new URL('../.secrets/grafana_admin_password.txt',import.meta.url),'utf8').trim()
  const auth={Authorization:'Basic '+Buffer.from(`${config.GRAFANA_ADMIN_USER||'admin'}:${grafanaPassword}`).toString('base64')}
  const requestId=(await request('/api/health/db')).headers['x-request-id']
  let logged=false
  for(let attempt=0;attempt<20;attempt++){
    const params=new URLSearchParams({query:`{service_name=~"nginx|nextjs"} |= "${requestId}"`,start:String(BigInt(Date.now()-300000)*1000000n),limit:'100'})
    const response=await fetch(grafana+'/api/datasources/proxy/uid/recipeshare-loki/loki/api/v1/query_range?'+params,{headers:auth})
    if(response.ok){const streams=(await response.json()).data.result;if(['nginx','nextjs'].every(service=>streams.some(stream=>stream.stream.service_name===service))){logged=true;break}}
    await pause(2000)
  }
  assert.ok(logged,'Missing production Nginx/Next.js correlated logs')
  await request('/api/auth/logout','POST')
  await request('/api/auth/me','GET',undefined,401)
  console.log('PASS: all nine production scrape targets, app scraping inside Compose, correlated Loki logs and logout invalidation.')
}finally{
  // Only remove this run's isolated account/content from the explicitly isolated DB.
  const db=await mysql.createConnection({host:'127.0.0.1',port:Number(config.MYSQL_PORT||3307),database:config.MYSQL_DATABASE||'recipeshare',user:'recipe_app',password:fs.readFileSync(new URL('../.secrets/mysql_app_password.txt',import.meta.url),'utf8')})
  try{
    if(!userId){const [rows]=await db.execute('SELECT id FROM users WHERE username = ?',[username]);userId=rows[0]?.id}
    if(userId){
      const [files]=await db.execute('SELECT storage_key FROM media_assets WHERE owner_id = ?',[userId])
      await db.beginTransaction()
      try{
        await db.execute('DELETE FROM post_revisions WHERE edited_by = ?',[userId])
        await db.execute('DELETE FROM posts WHERE author_id = ?',[userId])
        await db.execute('DELETE FROM tags WHERE created_by = ?',[userId])
        await db.execute('DELETE FROM user_profiles WHERE user_id = ?',[userId])
        await db.execute('DELETE FROM media_assets WHERE owner_id = ?',[userId])
        await db.execute('DELETE FROM users WHERE id = ? AND username = ?',[userId,username])
        await db.commit()
      }catch(error){await db.rollback();throw error}
      for(const file of files){if(!file.storage_key)continue;assert.ok(/^[a-f0-9-]{36}[.]png$/.test(file.storage_key));docker(['exec','-T','app','node','-e',"require('fs').unlinkSync(require('path').join('/data/uploads',process.argv[1]))",file.storage_key])}
      console.log('Isolated production account, content and image fixtures cleaned up; volumes preserved.')
    }
  }finally{await db.end();agent.destroy()}
}

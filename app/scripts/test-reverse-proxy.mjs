// Requires local Next.js on 3000 and Docker Nginx on TEST_BASE_URL (default 8080).
// Does not create users or modify application data; logout uses no session cookie.
import assert from 'node:assert/strict'
import http from 'node:http'
import {randomBytes} from 'node:crypto'
const base=process.env.TEST_BASE_URL||'http://localhost:8080'
const origin=new URL(base).origin
async function request(path,method='GET',headers={}){
  return fetch(base+path,{method,headers,signal:AbortSignal.timeout(120000)})
}
const live=await request('/health/live');assert.equal(live.status,200);assert.equal((await live.json()).service,'nginx')
const db=await request('/api/health/db');assert.equal(db.status,200);assert.equal((await db.json()).database,'connected')
const home=await request('/home');assert.equal(home.status,200);assert.match(await home.text(),/RecipeShare/);assert.equal(home.headers.get('x-content-type-options'),'nosniff');assert.match(home.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.doesNotMatch(home.headers.get('content-security-policy'),/default-src|script-src/)
const endpoints=[['/api/auth/logout','POST',200],['/api/posts','POST',401],['/api/profile','PATCH',401],['/api/media/upload','POST',401],['/api/posts/11111111-1111-4111-8111-111111111111/save','PUT',401],['/api/profiles/minhan/follow','PUT',401]]
for(const [path,method,expected] of endpoints){
 const accepted=await request(path,method,{Origin:origin,'Content-Type':'application/json','Sec-Fetch-Site':'same-origin'});assert.equal(accepted.status,expected,`${method} ${path}`);await accepted.text()
 const rejected=await request(path,method,{Origin:'https://evil.invalid','X-Forwarded-Host':'evil.invalid','Content-Type':'application/json'});assert.equal(rejected.status,403,path);assert.equal((await rejected.json()).code,'INVALID_ORIGIN')
}
await new Promise((resolve,reject)=>{
 const url=new URL('/_next/hmr',base)
 const req=http.request(url,{headers:{Connection:'Upgrade',Upgrade:'websocket','Sec-WebSocket-Version':'13','Sec-WebSocket-Key':randomBytes(16).toString('base64'),Origin:origin}})
 req.setTimeout(15000,()=>req.destroy(new Error('HMR handshake timed out')))
 req.on('upgrade',(response,socket)=>{socket.destroy();try{assert.equal(response.statusCode,101);resolve()}catch(error){reject(error)}})
 req.on('response',response=>{response.resume();reject(new Error('HMR returned '+response.statusCode))});req.on('error',reject);req.end()
})
console.log('PASS: Nginx liveness, DB/API/HTML, security headers, same-origin mutations, spoof rejection and HMR WebSocket 101.')

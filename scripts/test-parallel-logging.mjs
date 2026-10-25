// Read-only traffic plus a synthetic syslog error; no account/content mutations.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import https from 'node:https'
import {randomUUID} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {parseEnv} from 'node:util'

const envFile=process.argv[2]||'.env.production.local'
const config=parseEnv(fs.readFileSync(envFile,'utf8'))
assert.ok(config.COMPOSE_PROJECT_NAME,'Explicit Compose project required')
const compose=['compose','--env-file',envFile,'-f','compose.yaml','-f','compose.production.yaml']
const root=new URL('..',import.meta.url)
const agent=new https.Agent({ca:fs.readFileSync(new URL('../.secrets/tls/localhost.crt',import.meta.url))})
const base=`https://localhost:${config.HTTPS_PORT||8443}`
const grafana=`http://localhost:${config.GRAFANA_PORT||3002}`
const password=fs.readFileSync(new URL('../.secrets/grafana_admin_password.txt',import.meta.url),'utf8').trim()
const auth={Authorization:'Basic '+Buffer.from(`${config.GRAFANA_ADMIN_USER||'admin'}:${password}`).toString('base64')}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
function docker(args){return execFileSync('docker',[...compose,...args],{cwd:root,encoding:'utf8',stdio:'pipe'})}
async function json(url,headers={}){const response=await fetch(url,{headers,signal:AbortSignal.timeout(20000)});assert.equal(response.status,200,new URL(url).pathname);return response.json()}
function request(path){return new Promise((resolve,reject)=>{const req=https.get(base+path,{agent,headers:{'x-request-id':'untrusted-id'}},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,id:res.headers['x-request-id']}))});req.setTimeout(20000,()=>req.destroy(Error('HTTPS timeout')));req.on('error',reject)})}
const marker='private-query-'+randomUUID(),errorMarker='parallel-error-'+randomUUID()
const started=Date.now()-1000,ids=[]
async function logs(){
  const params=new URLSearchParams({query:'{service_name=~"nginx|nextjs",environment="production"}',start:String(BigInt(started)*1000000n),end:String(BigInt(Date.now())*1000000n),limit:'2000',direction:'forward'})
  const result=await json(grafana+'/api/datasources/proxy/uid/recipeshare-loki/loki/api/v1/query_range?'+params,auth)
  assert.equal(result.status,'success')
  return result.data.result.flatMap(stream=>stream.values.map(([,line])=>({labels:stream.stream,line})))
}
try{
  for(let i=0;i<5;i++){const response=await request('/api/health/db?token='+marker);assert.equal(response.status,200);assert.match(response.id,/^[a-f0-9]{32}$/);ids.push(response.id)}
  assert.equal((await request('/api/saved-posts')).status,401)
  const payload=`<132>Oct 25 12:00:00 local nginx: ${errorMarker} request="GET /safe?token=${marker} HTTP/1.1"`
  docker(['exec','-T','app','node','-e',"const d=require('node:dgram').createSocket('udp4');d.send(Buffer.from(process.argv[1]),1516,'promtail',e=>{d.close();if(e)process.exitCode=1})",payload])
  let rows=[]
  for(let attempt=0;attempt<30;attempt++){
    rows=await logs()
    if(ids.every(id=>['nginx','nextjs'].every(service=>rows.some(r=>r.labels.service_name===service&&r.line.includes(id))))&&rows.some(r=>r.line.includes(errorMarker)))break
    if(attempt===29)throw Error('Missing split-collector logs')
    await pause(1000)
  }
  await pause(2000);rows=await logs()
  // Query responses also expose structured metadata such as detected_level.
  const indexed=await json(grafana+'/api/datasources/proxy/uid/recipeshare-loki/loki/api/v1/labels',auth)
  assert.deepEqual(indexed.data.filter(key=>!['service_name','environment','kind','collector'].includes(key)),[],'Unexpected indexed labels')
  for(const id of ids){
    const nginx=rows.filter(r=>r.labels.service_name==='nginx'&&r.line.includes(id))
    const next=rows.filter(r=>r.labels.service_name==='nextjs'&&r.line.includes(id))
    assert.equal(nginx.length,1,'Duplicate or missing Nginx event')
    assert.equal(next.length,1,'Duplicate or missing API event')
    assert.equal(nginx[0].labels.collector,'promtail');assert.equal(next[0].labels.collector,'alloy')
  }
  const errors=rows.filter(r=>r.line.includes(errorMarker));assert.equal(errors.length,1)
  assert.equal(errors[0].labels.collector,'promtail');assert.equal(errors[0].labels.kind,'error');assert.match(errors[0].line,/\[redacted\]/)
  assert.ok(!rows.some(r=>r.line.includes(marker)),'Sensitive query leaked into Loki')
  const promtailId=docker(['ps','-q','promtail']).trim()
  const details=JSON.parse(execFileSync('docker',['inspect',promtailId],{encoding:'utf8'}))[0]
  assert.equal(details.Config.User,'10001:10001');assert.equal(details.HostConfig.ReadonlyRootfs,true)
  assert.equal(Object.keys(details.HostConfig.PortBindings||{}).length,0)
  assert.ok(details.HostConfig.CapDrop.includes('ALL'))
  assert.ok(!details.Mounts.some(m=>m.Source.includes('docker.sock')))
  const prometheus=`http://localhost:${config.PROMETHEUS_PORT||9090}`
  for(let attempt=0;attempt<30;attempt++){
    const targets=(await json(prometheus+'/api/v1/targets')).data.activeTargets
    if(['prometheus','nginx','recipeshare','grafana','loki','alloy','promtail','mysql','containers'].every(job=>targets.some(t=>t.labels.job===job&&t.health==='up')))break
    if(attempt===29)throw Error('Not all nine metrics targets are up')
    await pause(2000)
  }
  const board=await json(grafana+'/api/dashboards/uid/recipeshare-logs',auth)
  for(const panel of board.dashboard.panels.filter(p=>p.type==='timeseries')){
    const params=new URLSearchParams({query:panel.targets[0].expr.replaceAll('$__auto','1m'),start:String(BigInt(started)*1000000n),end:String(BigInt(Date.now())*1000000n),step:'15'})
    assert.equal((await json(grafana+'/api/datasources/proxy/uid/recipeshare-loki/loki/api/v1/query_range?'+params,auth)).status,'success')
  }
  console.log('PASS: Nginx via Promtail and Next.js via Alloy, one event per source/request ID, redacted error queries, unchanged dashboard queries, non-root isolated Promtail and all nine metrics targets.')
}finally{agent.destroy()}

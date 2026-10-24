import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createRequire} from 'node:module'
import {randomUUID} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {measureApi} from '../app/src/lib/monitoring/metrics.ts'

const require=createRequire(new URL('../app/package.json',import.meta.url))
const dotenv=require('dotenv')
const config=dotenv.parse(fs.readFileSync(new URL('../.env',import.meta.url)))
const appConfig=dotenv.parse(fs.readFileSync(new URL('../app/.env.local',import.meta.url)))
process.env.LOG_SYSLOG_PORT=appConfig.LOG_SYSLOG_PORT
process.env.LOG_SYSLOG_HOST=appConfig.LOG_SYSLOG_HOST||'127.0.0.1'
assert.equal(process.env.LOG_SYSLOG_PORT,'1514','Run scripts/init-monitoring.ps1 first')
const grafana=`http://localhost:${config.GRAFANA_PORT||3002}`
const site=`http://localhost:${config.WEB_PORT||8080}`
const password=fs.readFileSync(new URL('../.secrets/grafana_admin_password.txt',import.meta.url),'utf8').trim()
const headers={Authorization:'Basic '+Buffer.from(`${config.GRAFANA_ADMIN_USER||'admin'}:${password}`).toString('base64')}
async function get(path){
  const response=await fetch(grafana+path,{headers,signal:AbortSignal.timeout(20000)})
  assert.equal(response.status,200,path)
  return response.json()
}
const source=await get('/api/datasources/uid/recipeshare-loki')
assert.equal(source.url,'http://loki:3100')
const board=await get('/api/dashboards/uid/recipeshare-logs')
assert.ok(board.dashboard.panels.some(panel=>panel.type==='logs'))
const marker='private-query-'+randomUUID()
const started=Date.now()-1000
// Feed the actual Nginx error listener without interrupting the application.
execFileSync('docker',['compose','exec','-T','alloy','/bin/bash'],{
  input:`printf '%s' '<132>Oct 24 12:00:00 local nginx: synthetic-observability-error request="GET /safe?token=${marker} HTTP/1.1"' > /dev/udp/127.0.0.1/1516\n`,
  cwd:new URL('..',import.meta.url),stdio:['pipe','pipe','pipe'],
})
const health=await fetch(site+'/api/health/db?token='+marker,{headers:{'x-request-id':'client-must-not-control-id'},signal:AbortSignal.timeout(120000)})
assert.equal(health.status,200)
const requestId=health.headers.get('x-request-id')
assert.match(requestId,/^[a-f0-9]{32}$/)
const unauthenticated=await fetch(site+'/api/saved-posts',{signal:AbortSignal.timeout(120000)})
assert.equal(unauthenticated.status,401)
await health.text();await unauthenticated.text()
// Exercise the real error logger without adding a public failure endpoint or stopping DB.
const failureId=randomUUID().replaceAll('-','')
const failure=new Error('must-not-be-logged-'+marker)
await assert.rejects(measureApi('/api/observability-test','GET',async()=>{throw failure})(
  new Request('http://localhost/api/observability-test?token='+marker,{headers:{'x-request-id':failureId}})
),error=>error===failure)
let all=[]
for(let attempt=0;attempt<40;attempt++){
  const query=new URLSearchParams({query:'{service_name=~"nginx|nextjs"}',start:String(BigInt(started)*1000000n),end:String(BigInt(Date.now())*1000000n),limit:'1000',direction:'forward'})
  const result=await get('/api/datasources/proxy/uid/recipeshare-loki/loki/api/v1/query_range?'+query)
  all=result.data.result.flatMap(stream=>stream.values.map(([,line])=>({labels:stream.stream,line})))
  if(all.some(row=>row.labels.service_name==='nginx'&&row.line.includes(requestId))&&
     all.some(row=>row.labels.service_name==='nextjs'&&row.line.includes(requestId))&&
     all.some(row=>row.labels.service_name==='nextjs'&&row.line.includes(failureId))&&
     all.some(row=>row.labels.kind==='error'&&row.line.includes('synthetic-observability-error')))break
  if(attempt===39)throw Error('Missing correlated Nginx/Next.js logs or synthetic 500 event; restart Next.js after initializing syslog settings.')
  await new Promise(resolve=>setTimeout(resolve,2000))
}
assert.doesNotMatch(all.map(row=>row.line).join('\n'),new RegExp(marker))
assert.ok(all.some(row=>row.labels.kind==='error'&&row.line.includes('[redacted]')))
// Query responses may include detected_level structured metadata; check the index itself.
const indexed=await get('/api/datasources/proxy/uid/recipeshare-loki/loki/api/v1/labels')
assert.deepEqual(indexed.data.filter(key=>!['service_name','environment','kind'].includes(key)),[],'Unexpected indexed labels')
const api=JSON.parse(all.find(row=>row.labels.service_name==='nextjs'&&row.line.includes(requestId)).line)
assert.equal(api.route,'/api/health/db');assert.equal(api.status,200)
const failed=JSON.parse(all.find(row=>row.line.includes(failureId)).line)
assert.equal(failed.status,500);assert.equal(failed.level,'error')
for(const panel of board.dashboard.panels.filter(panel=>panel.type==='timeseries')){
  const query=new URLSearchParams({query:panel.targets[0].expr.replaceAll('$__auto','1m'),start:String(BigInt(started)*1000000n),end:String(BigInt(Date.now())*1000000n),step:'15'})
  assert.equal((await get('/api/datasources/proxy/uid/recipeshare-loki/loki/api/v1/query_range?'+query)).status,'success')
}
if(process.argv.includes('--restart-check')){
  execFileSync('docker',['compose','restart','loki'],{cwd:new URL('..',import.meta.url),stdio:'pipe'})
  let retained=false
  for(let attempt=0;attempt<30;attempt++){
    try {
      const query=new URLSearchParams({query:`{service_name="nextjs"} |= "${failureId}"`,start:String(BigInt(started)*1000000n),end:String(BigInt(Date.now())*1000000n),limit:'10'})
      const result=await get('/api/datasources/proxy/uid/recipeshare-loki/loki/api/v1/query_range?'+query)
      if(result.data.result.some(stream=>stream.values.some(([,line])=>line.includes(failureId)))){retained=true;break}
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,2000))
  }
  assert.ok(retained,'Existing log did not survive Loki restart')
  console.log('PASS: existing logs retained across Loki restart without deleting volumes.')
}
console.log('PASS: Grafana Loki datasource/dashboard, real correlated Nginx + Next.js traffic, synthetic 500, safe query omission and bounded labels.')

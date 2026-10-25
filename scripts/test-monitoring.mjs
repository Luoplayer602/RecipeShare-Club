import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const require=createRequire(new URL('../app/package.json',import.meta.url)),dotenv=require('dotenv')
const config=dotenv.parse(fs.readFileSync(new URL('../.env',import.meta.url)))
const prometheus=`http://localhost:${config.PROMETHEUS_PORT||9090}`,grafana=`http://localhost:${config.GRAFANA_PORT||3002}`,site=`http://localhost:${config.WEB_PORT||8080}`
const token=fs.readFileSync(new URL('../.secrets/metrics_bearer_token.txt',import.meta.url),'utf8').trim()
const password=fs.readFileSync(new URL('../.secrets/grafana_admin_password.txt',import.meta.url),'utf8').trim()
const authorization='Basic '+Buffer.from(`${config.GRAFANA_ADMIN_USER||'admin'}:${password}`).toString('base64')
async function get(url,headers={}){const response=await fetch(url,{headers,signal:AbortSignal.timeout(20000)});assert.equal(response.status,200,`${new URL(url).pathname}: ${response.status}`);return response.json()}
assert.equal((await get(grafana+'/api/health')).database,'ok')
for(const path of ['/api/health/db','/api/saved-posts','/api/posts/11111111-1111-4111-8111-111111111111'])await fetch(site+path).then(r=>r.text())
assert.equal((await fetch(site+'/api/metrics')).status,404)
assert.equal((await fetch('http://localhost:3000/api/metrics')).status,401)
assert.equal((await fetch('http://localhost:3000/api/metrics',{headers:{Authorization:'Bearer invalid'}})).status,401)
const response=await fetch('http://localhost:3000/api/metrics',{headers:{Authorization:'Bearer '+token}});assert.equal(response.status,200);const text=await response.text();assert.match(text,/recipeshare_api_requests_total/);assert.match(text,/route="\/api\/posts\/\[id\]"/);assert.doesNotMatch(text,/11111111-1111-4111-8111-111111111111/)
for(let attempt=0;attempt<30;attempt++){
 const {data}=await get(prometheus+'/api/v1/targets'),targets=data.activeTargets
 if(['prometheus','nginx','recipeshare','grafana','loki','alloy','promtail','mysql','containers'].every(job=>targets.some(t=>t.labels.job===job&&t.health==='up')))break
 if(attempt===29)throw Error('Some scrape targets remain down: '+targets.filter(t=>t.health!=='up').map(t=>t.labels.job+': '+t.lastError).join('; '))
 await new Promise(resolve=>setTimeout(resolve,3000))
}
const query=await get(prometheus+'/api/v1/query?query='+encodeURIComponent('recipeshare_api_requests_total'))
assert.ok(query.data.result.length>0)
const source=await get(grafana+'/api/datasources/uid/recipeshare-prometheus',{Authorization:authorization});assert.equal(source.url,'http://prometheus:9090')
const board=await get(grafana+'/api/dashboards/uid/recipeshare-overview',{Authorization:authorization});assert.ok(board.dashboard.panels.length>=10)
const queryResponse=await fetch(grafana+'/api/ds/query',{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify({from:String(Date.now()-300000),to:String(Date.now()),queries:[{refId:'A',datasource:{type:'prometheus',uid:'recipeshare-prometheus'},expr:'nginx_up',instant:true,format:'time_series',intervalMs:15000,maxDataPoints:100}]})});assert.equal(queryResponse.status,200);const frames=(await queryResponse.json()).results.A.frames;assert.ok(frames.some(frame=>frame.data.values.some(values=>values.includes(1))))
console.log('PASS: protected metrics, public-site denial, all nine scrape targets, API counters, provisioned dashboard and Grafana datasource query.')

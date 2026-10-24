import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {execFileSync} from 'node:child_process'

const root=new URL('..',import.meta.url)
const require=createRequire(new URL('../app/package.json',import.meta.url))
const dotenv=require('dotenv'),mysql=require('mysql2/promise')
const config=dotenv.parse(fs.readFileSync(new URL('../.env',import.meta.url)))
const app=dotenv.parse(fs.readFileSync(new URL('../app/.env.local',import.meta.url)))
const project=config.COMPOSE_PROJECT_NAME||'recipeshare-club'
const prometheus=`http://localhost:${config.PROMETHEUS_PORT||9090}`
const grafana=`http://localhost:${config.GRAFANA_PORT||3002}`
const password=fs.readFileSync(new URL('../.secrets/mysql_monitor_password.txt',import.meta.url),'utf8').trim()
const grafanaPassword=fs.readFileSync(new URL('../.secrets/grafana_admin_password.txt',import.meta.url),'utf8').trim()
const auth={Authorization:'Basic '+Buffer.from(`${config.GRAFANA_ADMIN_USER||'admin'}:${grafanaPassword}`).toString('base64')}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function json(url,headers={}){
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(20000)})
  assert.equal(response.status,200,new URL(url).pathname)
  return response.json()
}
async function query(expr){
  const result=await json(prometheus+'/api/v1/query?'+new URLSearchParams({query:expr}))
  assert.equal(result.status,'success')
  return result.data.result
}
const scope=`job="containers",com_docker_compose_project=${JSON.stringify(project)}`
const expected=execFileSync('docker',['compose','ps','--status','running','--services'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean)
for(let attempt=0;attempt<30;attempt++){
  const rows=await query(`docker_container_mem_usage{${scope},container_status="running"}`)
  if(expected.every(service=>rows.some(row=>row.metric.com_docker_compose_service===service && Number(row.value[1])>0)))break
  if(attempt===29)throw Error('Missing memory statistics for running Compose services: '+expected.filter(service=>!rows.some(row=>row.metric.com_docker_compose_service===service)).join(', '))
  await pause(3000)
}
for(const metric of ['docker_container_cpu_usage_percent','docker_container_net_rx_bytes','docker_container_net_tx_bytes','docker_container_status_uptime_ns']){
  const rows=await query(`${metric}{${scope},container_status="running"}`)
  assert.ok(expected.every(service=>rows.some(row=>row.metric.com_docker_compose_service===service && Number.isFinite(Number(row.value[1])))),metric+' missing a running service')
}
const errors=await query('internal_gather_errors{job="containers",input="docker"}')
assert.ok(errors.length>0,'Missing Docker collector internal health metric')
assert.ok(errors.every(row=>Number(row.value[1])===0),'Docker stats collection reported errors')
for(const name of ['mysql_up','mysql_global_status_threads_connected','mysql_global_variables_max_connections','mysql_global_status_innodb_buffer_pool_bytes_data']){
  const rows=await query(`${name}{job="mysql"}`)
  assert.ok(rows.length>0 && Number(rows[0].value[1])>0,name)
}
const before=Number((await query('mysql_global_status_queries{job="mysql"}'))[0].value[1])
const db=await mysql.createConnection({host:app.DB_HOST||'127.0.0.1',port:Number(app.DB_PORT||3307),user:'recipe_monitor',password})
try {
  const [grants]=await db.query('SHOW GRANTS')
  assert.equal(grants.length,1)
  assert.match(String(Object.values(grants[0])[0]),/^GRANT USAGE ON \*\.\* TO /)
  const database=mysql.escapeId(config.MYSQL_DATABASE||'recipeshare')
  await assert.rejects(db.query(`SELECT 1 FROM ${database}.users LIMIT 0`),error=>['ER_TABLEACCESS_DENIED_ERROR','ER_DBACCESS_DENIED_ERROR'].includes(error.code))
  for(let i=0;i<20;i++)await db.query('SELECT 1')
} finally { await db.end() }
let advanced=false
for(let attempt=0;attempt<15;attempt++){
  if(Number((await query('mysql_global_status_queries{job="mysql"}'))[0].value[1])>before){advanced=true;break}
  await pause(2000)
}
assert.ok(advanced,'MySQL query counter did not advance after real queries')

// Exercise the proxy from its only permitted client network; never mutate Docker.
for(const path of ['/_ping','/containers/json']){
  execFileSync('docker',['compose','exec','-T','container-metrics','wget','-q','-O','/dev/null','--timeout=5','http://docker-metrics-proxy:2375'+path],{cwd:root,stdio:'pipe'})
}
for(const [path,post] of [['/images/json',false],['/containers/'+'0'.repeat(64)+'/logs',false],['/containers/'+'0'.repeat(64)+'/archive',false],['/_ping',true]]){
  let output=''
  try {
    execFileSync('docker',['compose','exec','-T','container-metrics','wget','-S','-O','/dev/null','--timeout=5',...(post?['--post-data=']:[]),'http://docker-metrics-proxy:2375'+path],{cwd:root,stdio:'pipe'})
    assert.fail('Docker API proxy allowed '+path)
  }catch(error){
    output=error.stderr?.toString()||''
    assert.match(output,/403 Forbidden/,'Proxy must deny endpoint/method: '+path)
  }
}
for(const service of ['mysql-exporter','docker-metrics-proxy','container-metrics']){
  const id=execFileSync('docker',['compose','ps','-q',service],{cwd:root,encoding:'utf8'}).trim()
  const [container]=JSON.parse(execFileSync('docker',['inspect',id],{encoding:'utf8',stdio:'pipe'}))
  assert.equal(container.HostConfig.Privileged,false)
  assert.equal(container.HostConfig.ReadonlyRootfs,true)
  assert.ok(container.HostConfig.CapDrop.includes('ALL'))
  assert.ok(container.Config.User && !['0','root','0:0'].includes(container.Config.User),'Non-root collector required')
  assert.equal(Object.keys(container.HostConfig.PortBindings||{}).length,0,'Exporter/API must not publish host ports')
  if(service==='container-metrics')assert.ok(container.Mounts.every(mount=>!mount.Source.endsWith('docker.sock')))
}
const board=await json(grafana+'/api/dashboards/uid/recipeshare-infrastructure',auth)
assert.ok(board.dashboard.panels.length>=10)
for(const panel of board.dashboard.panels){
  for(const target of panel.targets||[]){
    const expr=target.expr.replaceAll('$__rate_interval','1m').replaceAll('$project',project)
    let populated=false
    for(let attempt=0;attempt<15;attempt++){
      const result=await json(grafana+'/api/datasources/proxy/uid/recipeshare-prometheus/api/v1/query?'+new URLSearchParams({query:expr}),auth)
      assert.equal(result.status,'success',panel.title)
      if(result.data.result.length>0){populated=true;break}
      await pause(2000) // Allow the first gather/flush/scrape after collector restart.
    }
    assert.ok(populated,'Dashboard panel has no data: '+panel.title)
  }
}
console.log(`PASS: MySQL USAGE-only permissions and live counters; CPU/RAM/network/uptime for ${expected.length} running Compose services; restricted non-root Docker API proxy; Grafana infrastructure panel queries.`)
if(process.argv.includes('--evidence')){
  const resources=new Map(expected.map(service=>[service,{service}]))
  for(const [metric,key] of [['docker_container_cpu_usage_percent','cpuPercent'],['docker_container_mem_usage','memoryBytes'],['docker_container_net_rx_bytes','receivedBytes'],['docker_container_net_tx_bytes','transmittedBytes']]){
    for(const row of await query(`${metric}{${scope},container_status="running"}`)){
      const entry=resources.get(row.metric.com_docker_compose_service)
      if(entry)entry[key]=Number(row.value[1])
    }
  }
  const mysqlSummary={}
  for(const [metric,key] of [['mysql_up','available'],['mysql_global_status_threads_connected','connectedThreads'],['mysql_global_variables_max_connections','maxConnections'],['mysql_global_status_queries','queries'],['mysql_global_status_uptime','uptimeSeconds']]){
    mysqlSummary[key]=Number((await query(`${metric}{job="mysql"}`))[0].value[1])
  }
  const evidence={observedAt:new Date().toISOString(),project,validation:{mysqlUsageOnly:true,applicationTableReadDenied:true,dockerApiAllowlist:true,nonRootCollectors:true,panelQueries:true},mysql:mysqlSummary,containers:[...resources.values()]}
  fs.writeFileSync(new URL('../docs/evidence/infrastructure-check.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n')
  console.log('Saved docs/evidence/infrastructure-check.json (metrics and checks only, no credentials).')
}

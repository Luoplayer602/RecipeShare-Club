import assert from 'node:assert/strict'
import {createSocket} from 'node:dgram'
import {once} from 'node:events'
import {logEvent,requestId} from '../src/lib/monitoring/logging.ts'
import {measureApi} from '../src/lib/monitoring/metrics.ts'

const receiver=createSocket('udp4'),messages=[]
receiver.on('message',message=>messages.push(message.toString()))
receiver.bind(0,'127.0.0.1')
await once(receiver,'listening')
const oldPort=process.env.LOG_SYSLOG_PORT,oldHost=process.env.LOG_SYSLOG_HOST
process.env.LOG_SYSLOG_PORT=String(receiver.address().port)
process.env.LOG_SYSLOG_HOST='127.0.0.1'
try {
  const id='a'.repeat(32)
  const request=new Request('http://localhost/api/test/private-id?token=secret',{
    headers:{'x-request-id':id,authorization:'Bearer secret',cookie:'session=secret'},
  })
  assert.equal(requestId(request),id)
  assert.notEqual(requestId(new Request('http://localhost',{headers:{'x-request-id':'untrusted text'}})),'untrusted text')
  const response=new Response('private-body',{status:201})
  assert.equal(await measureApi('/api/test/[id]','POST',async()=>response)(request),response)
  const failure=new Error('password=secret SQL private-body')
  await assert.rejects(measureApi('/api/test/[id]','GET',async()=>{throw failure})(request),error=>error===failure)
  logEvent({event:'server_started',level:'info',password:'secret',body:'private-body'})
  for(let attempt=0;messages.length<3 && attempt<100;attempt++)await new Promise(resolve=>setTimeout(resolve,10))
  assert.equal(messages.length,3)
  const events=messages.map(message=>JSON.parse(message.slice(message.indexOf('{'))))
  assert.equal(events[0].request_id,id)
  assert.equal(events[0].status,201)
  assert.equal(events[1].status,500)
  assert.equal(events[1].level,'error')
  assert.ok(events[0].duration_ms>=0)
  assert.match(messages[0],/^<134>1 /)
  assert.doesNotMatch(messages.join('\n'),/secret|private-id|private-body|password|authorization|cookie/)
  process.env.LOG_SYSLOG_PORT='invalid'
  assert.equal(await measureApi('/api/test','GET',async()=>response)(),response)
  globalThis.recipeShareLogSocket.close()
  process.env.LOG_SYSLOG_PORT='1514'
  assert.equal(await measureApi('/api/test','GET',async()=>response)(),response)
  console.log('PASS: UDP syslog, request correlation, redaction by allowlist, original Response/error and disabled/failed logger isolation.')
} finally {
  if(oldPort===undefined)delete process.env.LOG_SYSLOG_PORT;else process.env.LOG_SYSLOG_PORT=oldPort
  if(oldHost===undefined)delete process.env.LOG_SYSLOG_HOST;else process.env.LOG_SYSLOG_HOST=oldHost
  receiver.close()
}

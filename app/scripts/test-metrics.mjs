import assert from 'node:assert/strict'
import {measureApi,getMetrics} from '../src/lib/monitoring/metrics.ts'
const response=new Response('ok',{status:201,headers:{'X-Test':'kept'}})
const wrapped=measureApi('/api/test/[id]','POST',async(_request,context)=>{assert.equal(context.id,'private-id');return response})
assert.equal(await wrapped(new Request('http://localhost/api/test/private-id?q=secret'),{id:'private-id'}),response)
const error=new Error('original failure')
await assert.rejects(measureApi('/api/test/[id]','GET',async()=>{throw error})(),value=>value===error)
const registry=getMetrics().registry,body=await registry.metrics()
assert.match(body,/recipeshare_api_requests_total\{[^\n]*status="201"[^\n]*\} 1/)
assert.match(body,/recipeshare_api_requests_total\{[^\n]*status="500"[^\n]*\} 1/)
assert.match(body,/recipeshare_api_handler_duration_seconds_count/)
assert.doesNotMatch(body,/private-id|q=secret/)
assert.equal(getMetrics().registry,registry)
console.log('PASS: response identity, exceptions, bounded route labels, counters, histograms and shared registry.')

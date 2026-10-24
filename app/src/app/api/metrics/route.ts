import {timingSafeEqual} from 'node:crypto'
import {getMetrics} from '@/lib/monitoring/metrics'
export async function GET(request:Request){
  const token=process.env.METRICS_BEARER_TOKEN
  const headers={'Cache-Control':'no-store'}
  if(!token||token.length<32)return new Response('Metrics are not configured.',{status:503,headers})
  const expected=Buffer.from(`Bearer ${token}`),actual=Buffer.from(request.headers.get('authorization')??'')
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return new Response('Unauthorized',{status:401,headers})
  const {registry}=getMetrics()
  return new Response(await registry.metrics(),{headers:{...headers,'Content-Type':registry.contentType}})
}

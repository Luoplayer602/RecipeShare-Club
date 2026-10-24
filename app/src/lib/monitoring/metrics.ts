import {collectDefaultMetrics,Counter,Histogram,Registry} from '@prometheus-io/client'

type Metrics={registry:Registry;requests:Counter<'route'|'method'|'status'>;duration:Histogram<'route'|'method'|'status'>}
const runtime=globalThis as typeof globalThis & {recipeShareMetrics?:Metrics}
export function getMetrics():Metrics {
  if(runtime.recipeShareMetrics)return runtime.recipeShareMetrics
  const registry=new Registry()
  collectDefaultMetrics({register:registry,prefix:'recipeshare_'})
  const labels=['route','method','status'] as const
  const requests=new Counter({name:'recipeshare_api_requests_total',help:'Completed API handler calls; excludes metrics scrapes and framework-generated 404/405 responses.',labelNames:labels,registers:[registry]})
  const duration=new Histogram({name:'recipeshare_api_handler_duration_seconds',help:'API handler execution until Response creation, excluding dev compilation and response-body streaming.',labelNames:labels,buckets:[.005,.01,.025,.05,.1,.25,.5,1,2.5,5,10,30],registers:[registry]})
  runtime.recipeShareMetrics={registry,requests,duration}
  return runtime.recipeShareMetrics
}
/** Route and method are literals at the export, never user-controlled URLs/IDs. */
export function measureApi<Args extends unknown[]>(route:string,method:string,handler:(...args:Args)=>Promise<Response>){
  return async(...args:Args):Promise<Response>=>{
    const started=performance.now();let status='500'
    try {const response=await handler(...args);status=String(response.status);return response}
    finally {
      // Observability must never change a handler's result or mask its exception.
      try {const elapsed=(performance.now()-started)/1000,metrics=getMetrics(),labels={route,method,status};metrics.requests.inc(labels);metrics.duration.observe(labels,elapsed)}catch{}
    }
  }
}

import type {Instrumentation} from 'next'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const {logEvent} = await import('./lib/monitoring/logging')
    logEvent({event:'server_started',level:'info'})
  }
}

export const onRequestError: Instrumentation.onRequestError = async (_error, request, context) => {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const {logEvent,requestId} = await import('./lib/monitoring/logging')
    // routePath is a template; request.path, headers, message and stack are omitted.
    const id = request.headers['x-request-id']
    logEvent({event:'server_error',level:'error',route:context.routePath,
      method:request.method,status:500,route_type:context.routeType,
      request_id:typeof id==='string' && /^[a-f0-9]{32}$/i.test(id) ? id : requestId(undefined)})
  }
}

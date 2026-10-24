import {createSocket, type Socket} from 'node:dgram'
import {randomUUID} from 'node:crypto'

type LogEvent = {
  event: 'api_request' | 'server_error' | 'server_started'
  level: 'info' | 'warn' | 'error'
  route?: string
  method?: string
  status?: number
  duration_ms?: number
  request_id?: string
  route_type?: string
}
const runtime = globalThis as typeof globalThis & {recipeShareLogSocket?: Socket}

/** Only fixed-schema metadata is accepted; never pass requests or error objects. */
export function logEvent(event: LogEvent): void {
  try {
    const port = Number(process.env.LOG_SYSLOG_PORT)
    if (!Number.isInteger(port) || port < 1 || port > 65535) return
    let socket = runtime.recipeShareLogSocket
    if (!socket) {
      socket = createSocket('udp4')
      socket.on('error', () => {}) // Logging outages must not crash the app.
      socket.unref()
      runtime.recipeShareLogSocket = socket
    }
    // RFC5424: fixed header, JSON body. Do not buffer when the receiver is down.
    if (socket.getSendQueueCount() > 100) return
    const timestamp = new Date().toISOString()
    // Explicit allowlist also protects JS callers that pass extra fields.
    const line = JSON.stringify({timestamp, event:event.event, level:event.level,
      route:event.route, method:event.method, status:event.status,
      duration_ms:event.duration_ms, request_id:event.request_id, route_type:event.route_type})
    const severity = event.level === 'error' ? 3 : event.level === 'warn' ? 4 : 6
    const message = Buffer.from(`<${16 * 8 + severity}>1 ${timestamp} localhost nextjs - - - ${line}`)
    if (message.length > 8192) return
    socket.send(message, port, process.env.LOG_SYSLOG_HOST || '127.0.0.1', () => {})
  } catch { /* Observability must not change the application result. */ }
}

export function requestId(request: unknown): string {
  const forwarded = request instanceof Request ? request.headers.get('x-request-id') : null
  return forwarded && /^[a-f0-9]{32}$/i.test(forwarded) ? forwarded : randomUUID()
}

import {measureApi} from '@/lib/monitoring/metrics'
import { hasInvalidOrigin } from '@/lib/http/origin'
import { deleteSession } from '@/lib/auth/session'

const headers = { 'Cache-Control': 'no-store' }

async function POSTHandler(request: Request) {
  if (hasInvalidOrigin(request)) {
    return Response.json(
      { code: 'INVALID_ORIGIN' },
      { status: 403, headers },
    )
  }

  try {
    await deleteSession()

    return Response.json(
      { message: 'Logout successful.' },
      { headers },
    )
  } catch {
    return Response.json(
      { code: 'LOGOUT_UNAVAILABLE' },
      { status: 503, headers },
    )
  }
}
export const POST=measureApi("/api/auth/logout","POST",POSTHandler)

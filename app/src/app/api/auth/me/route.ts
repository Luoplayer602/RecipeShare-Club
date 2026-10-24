import {measureApi} from '@/lib/monitoring/metrics'
import { getSessionUser } from '@/lib/auth/session'

const headers = { 'Cache-Control': 'no-store' }

async function GETHandler() {
  try {
    const user = await getSessionUser()

    if (!user) {
      return Response.json(
        { code: 'UNAUTHENTICATED' },
        { status: 401, headers },
      )
    }

    return Response.json({ user }, { headers })
  } catch {
    return Response.json(
      { code: 'AUTH_UNAVAILABLE' },
      { status: 503, headers },
    )
  }
}
export const GET=measureApi("/api/auth/me","GET",GETHandler)

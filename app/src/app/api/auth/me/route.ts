import { getSessionUser } from '@/lib/auth/session'

const headers = { 'Cache-Control': 'no-store' }

export async function GET() {
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
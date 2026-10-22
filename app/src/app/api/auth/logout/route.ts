import { deleteSession } from '@/lib/auth/session'

const headers = { 'Cache-Control': 'no-store' }

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  const fetchSite = request.headers.get('sec-fetch-site')

  if (
    fetchSite === 'cross-site' ||
    (origin !== null && origin !== new URL(request.url).origin)
  ) {
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
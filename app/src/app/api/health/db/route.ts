import {measureApi} from '@/lib/monitoring/metrics'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { userTitles } from '@/db/schema'



async function GETHandler() {
  const headers = { 'Cache-Control': 'no-store' }

  try {
    const [title] = await db
      .select({ code: userTitles.code })
      .from(userTitles)
      .where(eq(userTitles.code, 'starter'))
      .limit(1)

    if (!title) {
      return Response.json(
        { status: 'error', code: 'DEFAULT_TITLE_MISSING' },
        { status: 503, headers },
      )
    }

    return Response.json(
      { status: 'ok', database: 'connected', defaultTitle: title.code },
      { headers },
    )
  } catch {
    return Response.json(
      { status: 'error', code: 'DATABASE_UNAVAILABLE' },
      { status: 503, headers },
    )
  }
}
export const GET=measureApi("/api/health/db","GET",GETHandler)

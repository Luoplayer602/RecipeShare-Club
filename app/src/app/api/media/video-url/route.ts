import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { db } from '@/db'
import { mediaAssets } from '@/db/schema'
import { getSessionUser } from '@/lib/auth/session'
import { createVideoUrlSchema } from '@/lib/media/validation'
import { hasInvalidOrigin, readEditorJson } from '@/lib/posts/request'

const headers = { 'Cache-Control': 'no-store' }

function respond(body: unknown, status: number) {
  return Response.json(body, { status, headers })
}

export async function POST(request: Request) {
  if (hasInvalidOrigin(request)) {
    return respond({ code: 'INVALID_ORIGIN' }, 403)
  }

  try {
    const user = await getSessionUser()

    if (!user) {
      return respond({ code: 'UNAUTHENTICATED' }, 401)
    }

    const bodyResult = await readEditorJson(request)

    if (!bodyResult.ok) {
      return respond(
        { code: bodyResult.code },
        bodyResult.status,
      )
    }

    const result = createVideoUrlSchema.safeParse(bodyResult.body)

    if (!result.success) {
      return respond({
        code: 'VALIDATION_ERROR',
        errors: z.flattenError(result.error),
      }, 422)
    }

    const video = result.data.url
    const id = randomUUID()

    await db.insert(mediaAssets).values({
      id,
      ownerId: user.id,
      kind: 'video',
      source: 'url',
      externalUrl: video.url,
    })

    return respond({
      message: 'Video URL added.',
      media: {
        id,
        kind: 'video',
        source: 'url',
        provider: video.provider,
        url: video.url,
      },
    }, 201)
  } catch {
    return respond({ code: 'MEDIA_CREATION_UNAVAILABLE' }, 503)
  }
}
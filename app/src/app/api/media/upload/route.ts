import { randomUUID } from 'node:crypto'
import { rename } from 'node:fs/promises'
import { db } from '@/db'
import { mediaAssets } from '@/db/schema'
import { getSessionUser } from '@/lib/auth/session'
import { hasInvalidOrigin } from '@/lib/posts/request'
import {
  receiveUpload,
  removeTemporaryUpload,
} from '@/lib/media/receive-upload'
import { getStoredFilePath } from '@/lib/media/storage'
import {
  inspectUpload,
  UploadError,
} from '@/lib/media/upload-policy'

const headers = { 'Cache-Control': 'no-store' }

function respond(body: unknown, status: number) {
  return Response.json(body, { status, headers })
}

export async function POST(request: Request) {
  if (hasInvalidOrigin(request)) {
    return respond({ code: 'INVALID_ORIGIN' }, 403)
  }

  let temporaryPath: string | null = null
  let storedPath: string | null = null
  let saved = false
  let stage = 'session'

  try {
    const user = await getSessionUser()

    if (!user) {
      return respond({ code: 'UNAUTHENTICATED' }, 401)
    }

    stage = 'receive'
    const upload = await receiveUpload(request)
    temporaryPath = upload.temporaryPath

    stage = 'inspect'
    const inspected = await inspectUpload(temporaryPath)
    const id = randomUUID()
    const storageKey = `${id}.${inspected.extension}`

    stage = 'storage-path'
    storedPath = getStoredFilePath(storageKey)

    stage = 'rename'
    await rename(temporaryPath, storedPath)
    temporaryPath = null

    stage = 'database'
    await db.insert(mediaAssets).values({
      id,
      ownerId: user.id,
      kind: inspected.kind,
      source: 'upload',
      storageKey,
      originalName: upload.originalName,
      mimeType: inspected.mimeType,
      metadata: {
        sizeBytes: inspected.sizeBytes,
      },
    })

    saved = true

    return respond({
      message: 'File uploaded.',
      media: {
        id,
        kind: inspected.kind,
        source: 'upload',
        originalName: upload.originalName,
        mimeType: inspected.mimeType,
        sizeBytes: inspected.sizeBytes,
      },
    }, 201)
  } catch (error) {
    if (error instanceof UploadError) {
      return respond({ code: error.code }, error.status)
    }

    const errors: Record<string, unknown>[] = []
    let current: unknown = error
    for (let depth = 0; depth < 5; depth++) {
      if (typeof current !== 'object' || current === null) break
      const details = current as Record<string, unknown>
      const summary: Record<string, unknown> = {}
      for (const key of ['name', 'code', 'errno', 'sqlState']) {
        if (key in details) summary[key] = details[key]
      }
      if (current instanceof TypeError || current instanceof ReferenceError) {
        summary.message = current.message
      }
      errors.push(summary)
      current = details.cause
    }
    console.error('[media/upload] Upload failed:', { stage, errors })
    return respond({ code: 'UPLOAD_UNAVAILABLE' }, 503)
  } finally {
    const cleanupPaths = [
      temporaryPath,
      saved ? null : storedPath,
    ].filter((value): value is string => value !== null)

    await Promise.all(cleanupPaths.map(async filePath => {
      try {
        await removeTemporaryUpload(filePath)
      } catch {
        console.error('[media/upload] File cleanup failed.')
      }
    }))
  }
}

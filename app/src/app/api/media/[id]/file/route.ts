import { open } from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { mediaAssets } from '@/db/schema'
import { getSessionUser } from '@/lib/auth/session'
import { getStoredFilePath } from '@/lib/media/storage'
import { parseByteRange } from '@/lib/media/byte-range'
import { isMediaPublic } from '@/lib/media/is-public'

const headers = { 'Cache-Control': 'private, no-store' }
const mediaIdSchema = z.uuid()

const allowedMimeTypes: Record<string, 'image' | 'video'> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
}

type Context = {
  params: Promise<{ id: string }>
}

function respond(code: string, status: number) {
  return Response.json({ code }, { status, headers })
}

export async function GET(request: Request, context: Context) {
  let handle: FileHandle | null = null

  try {
    const user = await getSessionUser()

    const { id } = await context.params
    const parsedId = mediaIdSchema.safeParse(id)

    if (!parsedId.success) {
      return respond('INVALID_MEDIA_ID', 400)
    }

    const [media] = await db
      .select({
        ownerId: mediaAssets.ownerId,
        kind: mediaAssets.kind,
        storageKey: mediaAssets.storageKey,
        mimeType: mediaAssets.mimeType,
      })
      .from(mediaAssets)
      .where(and(
        eq(mediaAssets.id, parsedId.data),
        eq(mediaAssets.source, 'upload'),
      ))
      .limit(1)

    if (
      !media?.storageKey ||
      !media.mimeType ||
      allowedMimeTypes[media.mimeType] !== media.kind
    ) {
      return respond('MEDIA_NOT_FOUND', 404)
    }

    const isOwner = user !== null && media.ownerId === user.id

    if (!isOwner && !(await isMediaPublic(parsedId.data))) {
      return respond('MEDIA_NOT_FOUND', 404)
    }

    handle = await open(getStoredFilePath(media.storageKey), 'r')
    const file = await handle.stat()

    if (!file.isFile() || file.size <= 0) {
      return respond('MEDIA_NOT_FOUND', 404)
    }

    const range = parseByteRange(
      request.headers.get('range'),
      file.size,
    )

    const fileHeaders: Record<string, string> = {
      ...headers,
      'Accept-Ranges': 'bytes',
      'Content-Type': media.mimeType,
      'Content-Disposition': `inline; filename="${media.storageKey}"`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': media.kind === 'video'
        ? "default-src 'none'; media-src 'self'; object-src 'none'; frame-ancestors 'none'"
        : "default-src 'none'; sandbox",
    }

    if (range.kind === 'invalid') {
      return new Response(null, {
        status: 416,
        headers: {
          ...fileHeaders,
          'Content-Range': `bytes */${file.size}`,
          'Content-Length': '0',
        },
      })
    }

    const partial = range.kind === 'partial'
    const start = partial ? range.start : 0
    const end = partial ? range.end : file.size - 1

    fileHeaders['Content-Length'] = String(end - start + 1)

    if (partial) {
      fileHeaders['Content-Range'] =
        `bytes ${start}-${end}/${file.size}`
    }

    const stream = handle.createReadStream({
      start,
      end,
      autoClose: true,
    })

    const body = Readable.toWeb(stream) as ReadableStream<Uint8Array>

    const response = new Response(body, {
      status: partial ? 206 : 200,
      headers: fileHeaders,
    })

    // The stream owns and closes the file handle.
    handle = null
    return response
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return respond('MEDIA_NOT_FOUND', 404)
    }

    console.error('[media/file] Read failed.')
    return respond('MEDIA_READ_UNAVAILABLE', 503)
  } finally {
    if (handle) {
      await handle.close().catch(() => {
        console.error('[media/file] File handle cleanup failed.')
      })
    }
  }
}

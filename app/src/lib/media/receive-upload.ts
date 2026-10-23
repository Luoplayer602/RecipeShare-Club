import 'server-only'

import busboy from 'busboy'
import { randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { ensureUploadDirectory } from './storage'
import { UploadError, VIDEO_BYTE_LIMIT } from './upload-policy'

export async function removeTemporaryUpload(filePath: string) {
  try {
    await unlink(filePath)
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return
    }

    throw error
  }
}

export async function receiveUpload(request: Request) {
  const contentType = request.headers.get('content-type') ?? ''

  if (!/^multipart\/form-data(?:;|$)/i.test(contentType)) {
    throw new UploadError('MULTIPART_REQUIRED', 415)
  }

  if (!request.body) {
    throw new UploadError('EMPTY_UPLOAD', 400)
  }

  let parser: ReturnType<typeof busboy>

  try {
    parser = busboy({
      headers: { 'content-type': contentType },
      limits: {
        files: 1,
        fields: 0,
        parts: 2,
        fileSize: VIDEO_BYTE_LIMIT,
        headerPairs: 100,
      },
    })
  } catch {
    throw new UploadError('INVALID_MULTIPART', 400)
  }

  const directory = await ensureUploadDirectory()
  const temporaryPath = path.join(directory, `${randomUUID()}.part`)

  let originalName = ''
  let receivedFile = false
  let failure: Error | null = null
  const writes: Promise<void>[] = []

  function fail(error: Error) {
    failure ??= error
  }

  parser.on('file', (fieldName, file, info) => {
    if (fieldName !== 'file' || receivedFile) {
      fail(new UploadError('SINGLE_FILE_REQUIRED', 400))
      file.resume()
      return
    }

    receivedFile = true

    if (!info.filename) {
      fail(new UploadError('FILE_NAME_REQUIRED', 400))
      file.resume()
      return
    }

    // Store only a display name, never use it as a filesystem path.
    originalName = (info.filename
      .replace(/\\/g, '/')
      .split('/')
      .pop() ?? '')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .slice(0, 255)

    if (!originalName.trim()) {
      fail(new UploadError('FILE_NAME_REQUIRED', 400))
      file.resume()
      return
    }

    file.on('limit', () => {
      fail(new UploadError('FILE_TOO_LARGE', 413))
    })

    const write = pipeline(
      file,
      createWriteStream(temporaryPath, {
        flags: 'wx',
        mode: 0o600,
      }),
    ).catch(error => {
      fail(error instanceof Error ? error : new Error('Upload write failed.'))
    })

    writes.push(write)
  })

  parser.on('filesLimit', () => {
    fail(new UploadError('SINGLE_FILE_REQUIRED', 400))
  })

  parser.on('fieldsLimit', () => {
    fail(new UploadError('UNEXPECTED_FORM_FIELD', 400))
  })

  parser.on('partsLimit', () => {
    fail(new UploadError('TOO_MANY_PARTS', 400))
  })

  // Allow a small amount of multipart overhead beyond the file limit.
  const requestByteLimit = VIDEO_BYTE_LIMIT + 64 * 1024
  let receivedBytes = 0

  const byteCounter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      receivedBytes += chunk.length

      if (receivedBytes > requestByteLimit) {
        callback(new UploadError('FILE_TOO_LARGE', 413))
        return
      }

      callback(null, chunk)
    },
  })

  const source = Readable.fromWeb(
    request.body as unknown as NodeReadableStream,
  )

  try {
    await pipeline(source, byteCounter, parser, {
      signal: request.signal,
    })
    await Promise.all(writes)

    if (failure) throw failure

    if (!receivedFile) {
      throw new UploadError('FILE_REQUIRED', 400)
    }

    return { temporaryPath, originalName }
  } catch (error) {
    await Promise.all(writes)
    await removeTemporaryUpload(temporaryPath)

    if (failure) throw failure
    if (error instanceof UploadError) throw error

    // Preserve filesystem errors as server errors.
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      ['ENOSPC', 'EACCES', 'EPERM', 'EIO'].includes(String(error.code))
    ) {
      throw error
    }

    throw new UploadError('INVALID_MULTIPART', 400)
  }
}

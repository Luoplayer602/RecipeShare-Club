import 'server-only'

import { stat } from 'node:fs/promises'
import { fileTypeFromFile } from 'file-type'

export const IMAGE_BYTE_LIMIT = 5 * 1024 * 1024
export const VIDEO_BYTE_LIMIT = 50 * 1024 * 1024

export class UploadError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: 400 | 413 | 415,
  ) {
    super(code)
    this.name = 'UploadError'
  }
}

type AllowedFormat = {
  kind: 'image' | 'video'
  extension: 'jpg' | 'png' | 'webp' | 'mp4' | 'webm'
  byteLimit: number
}

const allowedFormats: Record<string, AllowedFormat> = {
  'image/jpeg': {
    kind: 'image',
    extension: 'jpg',
    byteLimit: IMAGE_BYTE_LIMIT,
  },
  'image/png': {
    kind: 'image',
    extension: 'png',
    byteLimit: IMAGE_BYTE_LIMIT,
  },
  'image/webp': {
    kind: 'image',
    extension: 'webp',
    byteLimit: IMAGE_BYTE_LIMIT,
  },
  'video/mp4': {
    kind: 'video',
    extension: 'mp4',
    byteLimit: VIDEO_BYTE_LIMIT,
  },
  'video/webm': {
    kind: 'video',
    extension: 'webm',
    byteLimit: VIDEO_BYTE_LIMIT,
  },
}

export async function inspectUpload(filePath: string) {
  const file = await stat(filePath)

  if (!file.isFile() || file.size === 0) {
    throw new UploadError('EMPTY_UPLOAD', 400)
  }

  if (file.size > VIDEO_BYTE_LIMIT) {
    throw new UploadError('FILE_TOO_LARGE', 413)
  }

  const detected = await fileTypeFromFile(filePath)
  const format = detected ? allowedFormats[detected.mime] : undefined

  if (!detected || !format) {
    throw new UploadError('UNSUPPORTED_MEDIA_TYPE', 415)
  }

  if (file.size > format.byteLimit) {
    throw new UploadError('FILE_TOO_LARGE', 413)
  }

  return {
    kind: format.kind,
    extension: format.extension,
    mimeType: detected.mime,
    sizeBytes: file.size,
  }
}
import 'server-only'

import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const storageKeyPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp|mp4|webm)$/

export function getUploadDirectory(): string {
  const configured = process.env.MEDIA_UPLOAD_DIR?.trim()

  return path.resolve(/* turbopackIgnore: true */
    configured || path.join(process.cwd(), '.uploads'),
  )
}

export async function ensureUploadDirectory(): Promise<string> {
  const directory = getUploadDirectory()

  await mkdir(directory, {
    recursive: true,
    mode: 0o700,
  })

  return directory
}

export function getStoredFilePath(storageKey: string): string {
  if (!storageKeyPattern.test(storageKey)) {
    throw new Error('Invalid media storage key.')
  }

  return path.join(/* turbopackIgnore: true */ getUploadDirectory(), storageKey)
}

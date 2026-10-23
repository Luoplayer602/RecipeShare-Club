import 'server-only'

type JsonBodyResult =
  | { ok: true; body: unknown }
  | {
      ok: false
      status: 400 | 413 | 415
      code: string
    }

export function hasInvalidOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  const fetchSite = request.headers.get('sec-fetch-site')

  return (
    fetchSite === 'cross-site' ||
    (origin !== null && origin !== new URL(request.url).origin)
  )
}

export async function readEditorJson(
  request: Request,
): Promise<JsonBodyResult> {
  const contentType = request.headers.get('content-type')
    ?.split(';')[0]
    .trim()
    .toLowerCase()

  if (contentType !== 'application/json') {
    return { ok: false, status: 415, code: 'JSON_REQUIRED' }
  }

  const reader = request.body?.getReader()

  if (!reader) {
    return { ok: false, status: 400, code: 'INVALID_JSON' }
  }

  const chunks: Uint8Array[] = []
  const byteLimit = 1024 * 1024
  let size = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      size += value.byteLength

      if (size > byteLimit) {
        await reader.cancel()
        return { ok: false, status: 413, code: 'BODY_TOO_LARGE' }
      }

      chunks.push(value)
    }

    const text = new TextDecoder('utf-8', { fatal: true })
      .decode(Buffer.concat(chunks))

    return { ok: true, body: JSON.parse(text) }
  } catch {
    return { ok: false, status: 400, code: 'INVALID_JSON' }
  } finally {
    reader.releaseLock()
  }
}
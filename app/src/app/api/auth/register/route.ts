import {measureApi} from '@/lib/monitoring/metrics'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { users, userTitles } from '@/db/schema'
import { hashPassword } from '@/lib/auth/password'
import { registerSchema } from '@/lib/auth/validation'

const headers = { 'Cache-Control': 'no-store' }

function respond(body: unknown, status: number) {
  return Response.json(body, { status, headers })
}

// Drizzle may wrap the MySQL error in `cause`.
function isDuplicateEntry(error: unknown): boolean {
  let current = error

  for (let depth = 0; depth < 5; depth++) {
    if (typeof current !== 'object' || current === null) return false
    if ('code' in current && current.code === 'ER_DUP_ENTRY') return true
    if (!('cause' in current)) return false
    current = current.cause
  }

  return false
}

function getSafeErrorSummary(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return { errorType: typeof error }
  }

  const details = error as Record<string, unknown>
  const summary: Record<string, unknown> = {}
  // Drizzle messages include SQL parameters, including contact details and hashes.
  for (const key of ['name', 'code', 'errno', 'sqlState'] as const) {
    if (key in details) summary[key] = details[key]
  }

  return summary
}

async function POSTHandler(request: Request) {
  const contentType = request.headers
    .get('content-type')
    ?.split(';')[0]
    .trim()
    .toLowerCase()

  if (contentType !== 'application/json') {
    return respond({ code: 'JSON_REQUIRED' }, 415)
  }

  let body: unknown

  try {
    // Limit bytes while reading, including requests without Content-Length.
    const reader = request.body?.getReader()
    if (!reader) return respond({ code: 'INVALID_JSON' }, 400)

    const chunks: Uint8Array[] = []
    let size = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      size += value.byteLength
      if (size > 8192) {
        await reader.cancel()
        return respond({ code: 'BODY_TOO_LARGE' }, 413)
      }

      chunks.push(value)
    }

    body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return respond({ code: 'INVALID_JSON' }, 400)
  }

  const result = registerSchema.safeParse(body)
  if (!result.success) {
    return respond({
      code: 'VALIDATION_ERROR',
      errors: z.flattenError(result.error),
    }, 422)
  }

  const input = result.data

  try {
    const [title] = await db
      .select({ id: userTitles.id })
      .from(userTitles)
      .where(eq(userTitles.code, 'starter'))
      .limit(1)

    if (!title) {
      return respond({ code: 'REGISTRATION_UNAVAILABLE' }, 503)
    }

    const id = randomUUID()
    const passwordHash = await hashPassword(input.password)

    await db.insert(users).values({
      id,
      username: input.username,
      displayName: input.displayName,
      email: input.email,
      phone: input.phone,
      passwordHash,
      role: 'member',
      status: 'active',
      titleId: title.id,
    })

    return respond({
      message: 'Registration successful.',
      user: {
        id,
        username: input.username,
        displayName: input.displayName,
        role: 'member',
        titleId: title.id,
      },
    }, 201)
  } catch (error) {
    if (isDuplicateEntry(error)) {
      return respond({
        code: 'ACCOUNT_ALREADY_EXISTS',
        message: 'Username, email, or phone number is already in use.',
      }, 409)
    }

    // Keep the server log useful without logging the request or password.
    console.error('[auth/register] Registration failed:', getSafeErrorSummary(error))
    return respond({ code: 'REGISTRATION_FAILED' }, 500)
  }
}

export const POST=measureApi("/api/auth/register","POST",POSTHandler)

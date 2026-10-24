import {measureApi} from '@/lib/monitoring/metrics'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { users } from '@/db/schema'
import { verifyPassword } from '@/lib/auth/password'
import {
  classifyLoginIdentifier,
  loginSchema,
  type LoginIdentifier,
} from '@/lib/auth/validation'
import { createSession } from '@/lib/auth/session'

const headers = { 'Cache-Control': 'no-store' }

const BODY_BYTE_LIMIT = 8192

// Use a dummy hash with the same scrypt parameters for missing accounts.
// Run scrypt to reduce differences in response timing.
const DUMMY_PASSWORD_HASH =
  'scrypt$131072$8$1$' + '00'.repeat(16) + '$' + '00'.repeat(64)

function respond(body: unknown, status: number) {
  return Response.json(body, { status, headers })
}

function getSafeErrorSummary(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return { errorType: typeof error }
  }

  const details = error as Record<string, unknown>
  const summary: Record<string, unknown> = {}
  // Do not include `message` in logs: mysql2/Drizzle may include SQL and parameters.
  for (const key of ['name', 'code', 'errno', 'sqlState'] as const) {
    if (key in details) summary[key] = details[key]
  }

  return summary
}

function findByColumn(identifier: LoginIdentifier) {
  if (identifier.type === 'email') return eq(users.email, identifier.value)
  if (identifier.type === 'phone') return eq(users.phone, identifier.value)
  return eq(users.username, identifier.value)
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
    const reader = request.body?.getReader()
    if (!reader) return respond({ code: 'INVALID_JSON' }, 400)

    const chunks: Uint8Array[] = []
    let size = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      size += value.byteLength
      if (size > BODY_BYTE_LIMIT) {
        await reader.cancel()
        return respond({ code: 'BODY_TOO_LARGE' }, 413)
      }

      chunks.push(value)
    }

    body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return respond({ code: 'INVALID_JSON' }, 400)
  }

  const result = loginSchema.safeParse(body)
  if (!result.success) {
    return respond({
      code: 'VALIDATION_ERROR',
      errors: z.flattenError(result.error),
    }, 422)
  }

  const input = result.data
  const identifier = classifyLoginIdentifier(input.identifier)

  try {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        passwordHash: users.passwordHash,
        role: users.role,
        status: users.status,
        titleId: users.titleId,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(findByColumn(identifier))
      .limit(1)

    if (!user) {
      await verifyPassword(input.password, DUMMY_PASSWORD_HASH)
      return respond({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid login credentials.',
      }, 401)
    }

    if (user.status !== 'active') {
      return respond({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid login credentials.',
      }, 401)
    }

    // Accounts without a password cannot use password login.
    // Still run scrypt on the dummy hash to reduce timing differences.
    const storedHash = user.passwordHash ?? DUMMY_PASSWORD_HASH
    const passwordMatches = await verifyPassword(input.password, storedHash)

    if (!passwordMatches) {
      return respond({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid login credentials.',
      }, 401)
    }

    await createSession(user.id)
    return respond({
      message: 'Login successful.',
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        titleId: user.titleId,
        avatarUrl: user.avatarUrl,
      },
    }, 200)
  } catch (error) {
    console.error('[auth/login] Login failed:', getSafeErrorSummary(error))
    return respond({ code: 'LOGIN_UNAVAILABLE' }, 503)
  }
}
export const POST=measureApi("/api/auth/login","POST",POSTHandler)

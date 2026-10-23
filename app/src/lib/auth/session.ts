import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import { db } from '@/db'
import { users, userSessions, userTitles } from '@/db/schema'

const COOKIE_NAME = 'recipe_session'
const SESSION_SECONDS = 7 * 24 * 60 * 60

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function isValidToken(token: string): boolean {
  return /^[a-f0-9]{64}$/.test(token)
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000)
  const cookieStore = await cookies()

  await db.insert(userSessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt,
  })

  cookieStore.set(COOKIE_NAME, token, {
    ...cookieOptions,
    expires: expiresAt,
    maxAge: SESSION_SECONDS,
  })
}

export async function getSessionUser() {
  await connection()
  const token = (await cookies()).get(COOKIE_NAME)?.value
  if (!token || !isValidToken(token)) return null

  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      titleId: users.titleId,
      titleName: userTitles.name,
      avatarUrl: users.avatarUrl,
    })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .innerJoin(userTitles, eq(users.titleId, userTitles.id))
    .where(
      and(
        eq(userSessions.tokenHash, hashToken(token)),
        gt(userSessions.expiresAt, new Date()),
        eq(users.status, 'active'),
      ),
    )
    .limit(1)

  return user ?? null
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (token && isValidToken(token)) {
    await db
      .delete(userSessions)
      .where(eq(userSessions.tokenHash, hashToken(token)))
  }

  cookieStore.set(COOKIE_NAME, '', {
    ...cookieOptions,
    expires: new Date(0),
    maxAge: 0,
  })
}

/** Re-emit the validated session from a Server Action so Next clears auth-dependent UI caches. */
export async function refreshSessionCookie(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token || !isValidToken(token)) return false
  const now = new Date()
  const [session] = await db.select({ expiresAt: userSessions.expiresAt })
    .from(userSessions)
    .where(and(eq(userSessions.tokenHash, hashToken(token)), gt(userSessions.expiresAt, now)))
    .limit(1)
  if (!session) return false
  cookieStore.set(COOKIE_NAME, token, {
    ...cookieOptions,
    expires: session.expiresAt,
    maxAge: Math.max(0, Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000)),
  })
  return true
}

'use server'

import { revalidatePath } from 'next/cache'
import { redirect, RedirectType } from 'next/navigation'
import { deleteSession, getSessionUser, refreshSessionCookie } from './session'

export async function completeLoginAction() {
  if (!await getSessionUser()) return { error: 'UNAUTHENTICATED' }
  if (!await refreshSessionCookie()) return { error: 'UNAUTHENTICATED' }
  revalidatePath('/', 'layout')
  redirect('/home', RedirectType.replace)
}

export async function logoutAction() {
  try {
    await deleteSession()
  } catch {
    return { error: 'LOGOUT_UNAVAILABLE' }
  }
  // Session mutations must invalidate previously visited/prefetched auth pages too.
  revalidatePath('/', 'layout')
  redirect('/home', RedirectType.replace)
}

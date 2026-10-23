'use client'

import Link from 'next/link'
import { CreatePost } from './create-post'
import { AccountMenu } from './account-menu'
import type { SessionUser } from './types'
import shell from './shell.module.css'
import styles from './account-area.module.css'

export function AccountArea({ user }: { user: SessionUser | null }) {
  return <div className={styles.area} data-authenticated={Boolean(user)}>
    <div className={styles.guest} aria-hidden={Boolean(user)} inert={Boolean(user)}>
      <Link className={shell.createButton} href="/">Đăng nhập</Link>
    </div>
    {user && <div className={styles.member}>
      <div className={styles.create}><CreatePost /></div>
      <div className={styles.user}><AccountMenu user={user} /></div>
    </div>}
  </div>
}

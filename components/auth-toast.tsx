'use client'

import styles from './auth-toast.module.css'

export function AuthToast({ message }: { message: string }) {
  return (
    <div className={styles.region} role="status" aria-live="polite" aria-atomic="true">
      {message && (
        <div key={message} className={styles.card}>
          <span>{message}</span>
          <span className={styles.icon} aria-hidden="true">!</span>
        </div>
      )}
    </div>
  )
}

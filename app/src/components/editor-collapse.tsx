'use client'

import type { ReactNode } from 'react'
import styles from './editor-collapse.module.css'

export function EditorCollapse({ open, children }: { open: boolean; children: ReactNode }) {
  return <div className={styles.collapse} data-open={open} aria-hidden={!open} inert={!open}>
    <div className={styles.inner}>{children}</div>
  </div>
}

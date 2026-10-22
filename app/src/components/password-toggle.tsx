'use client'

import { useState } from 'react'
import styles from './password-toggle.module.css'

type PasswordToggleProps = {
  visible: boolean
  onToggle: () => void
  inputId: string
  label: string
}

export function PasswordToggle({ visible, onToggle, inputId, label }: PasswordToggleProps) {
  const [touched, setTouched] = useState(false)

  return (
    <button
      type="button"
      className={`icon-button ${styles.button} ${!visible ? styles.hidden : ''} ${touched && !visible ? styles.hiding : ''}`}
      onClick={() => { setTouched(true); onToggle() }}
      aria-label={`${visible ? 'Ẩn' : 'Hiện'} ${label}`}
      aria-controls={inputId}
      aria-pressed={visible}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <g className={styles.eyeMotion}>
          <g className={styles.blink}>
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
          </g>
        </g>
        <path className={styles.slash} pathLength="1" d="M3 3 21 21" />
      </svg>
    </button>
  )
}

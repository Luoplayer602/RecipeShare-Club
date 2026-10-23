'use client'
import { useState } from 'react'
import { X } from 'lucide-react'
import styles from './editor-tag.module.css'

export function EditorTag({ name, onRemove }: { name: string; onRemove: () => void }) {
  const [removing, setRemoving] = useState(false)
  return <span className={`${styles.tag} ${removing ? styles.removing : ''}`} onAnimationEnd={event => {
    if (removing && event.target === event.currentTarget) onRemove()
  }}>{name}<button type="button" disabled={removing} aria-label={`Xóa nhãn ${name}`} onClick={() => setRemoving(true)}><X size={12} /></button></span>
}

'use client'

import { useId, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { EditorCollapse } from './editor-collapse'
import styles from './image-alt-field.module.css'

export function ImageAltField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return <div className={styles.field}>
    <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={id} onClick={() => setOpen(current => !current)}>
      <ChevronRight size={12} aria-hidden="true" />Mô tả ảnh cho người đọc màn hình
    </button>
    <EditorCollapse open={open}><div id={id} className={styles.content}>
      <input aria-label="Văn bản thay thế ảnh" placeholder="Mô tả ngắn nội dung trong ảnh…" value={value} maxLength={255} onChange={event => onChange(event.target.value)} />
    </div></EditorCollapse>
  </div>
}

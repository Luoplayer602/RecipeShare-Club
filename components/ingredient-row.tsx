'use client'
import { useLayoutEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import styles from './ingredient-row.module.css'

type Ingredient = { id: string; name: string; quantity: string; unit: string; note: string }
export function IngredientRow({ row, index, onChange, onRemove }: { row: Ingredient; index: number; onChange: (key: 'name' | 'quantity' | 'unit' | 'note', value: string) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false)
  const [removing, setRemoving] = useState(false)
  const removed = useRef(false)
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  function remove() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { onRemove(); return }
    setRemoving(true); setOpen(false)
  }
  return <tr className={styles.row} data-open={open} inert={removing} onTransitionEnd={event => {
    if (removing && !removed.current && event.propertyName === 'grid-template-rows') { removed.current = true; onRemove() }
  }}>
    {(['name', 'quantity', 'unit', 'note'] as const).map(key => <td key={key}><div className={styles.cell}><div className={styles.inner}><input aria-label={`${key}, dòng ${index + 1}`} value={row[key]} placeholder={key === 'note' ? 'Không bắt buộc' : '…'} onChange={event => onChange(key, event.target.value)} /></div></div></td>)}
    <td><div className={styles.cell}><div className={styles.inner}><button className={styles.remove} type="button" aria-label={`Xóa nguyên liệu ${index + 1}`} onClick={remove}><Trash2 size={15} /></button></div></div></td>
  </tr>
}

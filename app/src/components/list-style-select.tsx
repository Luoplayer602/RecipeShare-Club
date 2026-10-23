'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { listStyles, type ListStyle } from './list-content'
import styles from './list-style-select.module.css'

export function ListStyleSelect({ value, onChange }: { value: ListStyle; onChange: (value: ListStyle) => void }) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const id = useId()
  function close(restore = false) { setClosing(true); if (restore) trigger.current?.focus({ preventScroll: true }) }
  function show() {
    const rect = trigger.current?.getBoundingClientRect()
    if (!rect) return
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 228)), top: rect.bottom + Math.min(320, window.innerHeight - 16) + 7 < window.innerHeight ? rect.bottom + 7 : Math.max(8, rect.top - Math.min(320, window.innerHeight - 16) - 7) })
    setClosing(false); setOpen(true)
  }
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLButtonElement>(`[data-value="${value}"]`)?.focus({ preventScroll: true })
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setClosing(true)
    }
    const move = (event: Event) => { if (!menu.current?.contains(event.target as Node)) setClosing(true) }
    document.addEventListener('pointerdown', outside)
    window.addEventListener('scroll', move, true)
    window.addEventListener('resize', move)
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('scroll', move, true); window.removeEventListener('resize', move) }
  }, [open, value])
  return <>
    <button type="button" ref={trigger} className={styles.trigger} aria-label={`Kiểu danh sách: ${listStyles.find(item => item.value === value)?.label}`} aria-haspopup="listbox" aria-expanded={open && !closing} aria-controls={open ? id : undefined} onClick={() => open ? close() : show()} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show() }
    }}>{listStyles.find(item => item.value === value)?.label}<ChevronDown size={13} /></button>
    {open && createPortal(<div id={id} ref={menu} role="listbox" aria-label="Kiểu danh sách" className={`${styles.menu} ${closing ? styles.closing : ''}`} style={position} inert={closing} onAnimationEnd={event => {
      if (closing && event.target === event.currentTarget) { setOpen(false); setClosing(false) }
    }} onKeyDown={event => {
      const options = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
      const current = options.indexOf(document.activeElement as HTMLButtonElement)
      if (event.key === 'Escape') { event.preventDefault(); close(true) }
      else if (event.key === 'Tab') close()
      else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault()
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
        options[next]?.focus()
      }
    }}>{listStyles.map(({ value: style, label }) => <button key={style} type="button" role="option" aria-selected={value === style} data-value={style} onClick={() => { onChange(style); close(true) }}>{label}{value === style && <Check size={13} />}</button>)}</div>, document.body)}
  </>
}

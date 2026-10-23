'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import styles from './heading-level-select.module.css'

export function HeadingLevelSelect({ value, onChange }: { value: number; onChange: (value: number) => void }) {
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
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 104)), top: rect.bottom + 142 < window.innerHeight ? rect.bottom + 7 : Math.max(8, rect.top - 142) })
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
    <button type="button" ref={trigger} className={styles.trigger} aria-label={`Cấp tiêu đề H${value}`} aria-haspopup="listbox" aria-expanded={open && !closing} aria-controls={open ? id : undefined} onClick={() => open ? close() : show()} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show() }
    }}>H{value}<ChevronDown size={13} /></button>
    {open && createPortal(<div id={id} ref={menu} role="listbox" aria-label="Cấp tiêu đề" className={`${styles.menu} ${closing ? styles.closing : ''}`} style={position} inert={closing} onAnimationEnd={event => {
      if (closing && event.target === event.currentTarget) { setOpen(false); setClosing(false) }
    }} onKeyDown={event => {
      const options = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
      const current = options.indexOf(document.activeElement as HTMLButtonElement)
      if (event.key === 'Escape') { event.preventDefault(); close(true) }
      else if (event.key === 'Tab') close()
      else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault()
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (current + (event.key === 'ArrowDown' ? 1 : -1) + 3) % 3
        options[next]?.focus()
      }
    }}>{[1, 2, 3].map(level => <button key={level} type="button" role="option" aria-selected={value === level} data-value={level} onClick={() => { onChange(level); close(true) }}>H{level}{value === level && <Check size={13} />}</button>)}</div>, document.body)}
  </>
}

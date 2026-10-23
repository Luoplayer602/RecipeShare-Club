'use client'
import { useRef } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import styles from './number-stepper.module.css'

export function NumberStepper({ label, value, min, max, onChange }: { label: string; value: string; min: number; max: number; onChange: (value: string) => void }) {
  const input = useRef<HTMLInputElement>(null)
  function step(direction: number) {
    if (!input.current) return
    if (direction > 0) input.current.stepUp()
    else input.current.stepDown()
    onChange(input.current.value)
  }
  return <div className={styles.stepper}>
    <input ref={input} aria-label={label} type="number" min={min} max={max} value={value} onChange={event => onChange(event.target.value)} />
    <span className={styles.arrows}><button type="button" aria-label={`Tăng ${label.toLowerCase()}`} disabled={value !== '' && Number(value) >= max} onClick={() => step(1)}><ChevronUp size={12} /></button><button type="button" aria-label={`Giảm ${label.toLowerCase()}`} disabled={value !== '' && Number(value) <= min} onClick={() => step(-1)}><ChevronDown size={12} /></button></span>
  </div>
}

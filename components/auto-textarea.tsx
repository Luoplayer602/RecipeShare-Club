'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'
import styles from './auto-textarea.module.css'

export function AutoTextarea({ className = '', onInput, value, maxRows, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { maxRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const resize = useCallback(() => {
    const field = ref.current
    if (!field) return
    field.style.height = 'auto'
    const computed = getComputedStyle(field)
    const border = parseFloat(computed.borderTopWidth) + parseFloat(computed.borderBottomWidth)
    const cssMax = parseFloat(computed.maxHeight)
    const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.5
    const rowMax = maxRows ? maxRows * lineHeight + parseFloat(computed.paddingTop) + parseFloat(computed.paddingBottom) + border : Infinity
    const max = Math.min(Number.isFinite(cssMax) ? cssMax : Infinity, rowMax)
    const height = field.scrollHeight + border
    field.style.height = `${Math.min(height, Number.isFinite(max) ? max : height)}px`
    field.style.overflowY = height > max ? 'auto' : 'hidden'
  }, [maxRows])
  useLayoutEffect(resize, [resize, value])
  useEffect(() => {
    const field = ref.current
    if (!field) return
    let width = field.getBoundingClientRect().width
    let frame = 0
    const observer = new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.width ?? 0
      if (next !== width) { width = next; resize() }
    })
    const reset = () => { frame = requestAnimationFrame(resize) }
    observer.observe(field)
    field.form?.addEventListener('reset', reset)
    window.addEventListener('resize', resize)
    return () => { observer.disconnect(); cancelAnimationFrame(frame); field.form?.removeEventListener('reset', reset); window.removeEventListener('resize', resize) }
  }, [resize])
  return <textarea {...props} value={value} ref={ref} className={`${styles.textarea} ${className}`} onInput={event => { onInput?.(event); resize() }} />
}

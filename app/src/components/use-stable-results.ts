'use client'

import { useCallback, useLayoutEffect, useRef } from 'react'

/** Reserve the old results before changing filters, then reveal the replacement. */
export function useStableResults(pending: boolean, selection: string) {
  const region = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const held = useRef<number | null>(null)
  const animations = useRef<Animation[]>([])
  const capture = useCallback(() => {
    const node = region.current
    const main = node?.closest('main')
    if (!node || !main) return
    const rect = node.getBoundingClientRect()
    // Keep enough room below the current viewport to prevent scroll clamping,
    // even when the next tab contains fewer cards or is empty.
    const floor = Math.max(main.clientHeight + 64, main.getBoundingClientRect().bottom - rect.top + 32)
    const height = Math.max(rect.height, floor)
    animations.current.forEach(animation => animation.cancel())
    node.style.minHeight = `${floor}px`
    node.style.height = `${height}px`
    held.current = height
  }, [])
  useLayoutEffect(() => {
    const node = region.current
    if (pending || held.current === null || !node || !content.current) return
    const from = held.current
    held.current = null
    const to = Math.max(content.current.offsetHeight, parseFloat(node.style.minHeight) || 0)
    node.style.removeProperty('height')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const resize = node.animate([{ height: `${from}px` }, { height: `${to}px` }], {
      duration: 450, easing: 'cubic-bezier(.22,.8,.3,1)',
    })
    const reveal = content.current.animate([
      { opacity: 0, transform: 'translateY(18px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 450, easing: 'cubic-bezier(.22,.8,.3,1)' })
    animations.current = [resize, reveal]
  }, [pending, selection])
  useLayoutEffect(() => () => animations.current.forEach(animation => animation.cancel()), [])
  return { region, content, capture }
}

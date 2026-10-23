'use client'

import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bookmark, Home, Users } from 'lucide-react'
import styles from './community-nav.module.css'

type View = 'home' | 'saved' | 'following'
export function CommunityNav({ active, savedCount, onSelect }: { active?: View; savedCount: number; onSelect?: (view: View) => void }) {
  const marker = useRef<HTMLDivElement>(null)
  const transition = useRef<{ target: number; from: number } | null>(null)
  const pathname = usePathname()
  if (!onSelect && pathname === '/following') active = 'following'
  const index = active === 'following' ? 2 : active === 'saved' ? 1 : 0
  useLayoutEffect(() => {
    if (!active) return
    if (transition.current?.target !== index) {
      let from = index
      try {
        const stored = Number(sessionStorage.getItem('recipeshare-nav-index') ?? index)
        if (Number.isInteger(stored) && stored >= 0 && stored <= 2) from = stored
        sessionStorage.setItem('recipeshare-nav-index', String(index))
      } catch { /* Navigation works without storage. */ }
      transition.current = { target: index, from }
    }
    const previous = transition.current.from
    if (!active || !marker.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches || previous === index) return
    const mobile = window.matchMedia('(max-width:760px)').matches
    const links = marker.current.parentElement?.querySelectorAll<HTMLElement>('a,button')
    const start = links?.[previous]
    const end = links?.[index]
    if (!start || !end) return
    const x0 = mobile ? start.offsetLeft : 0
    const y0 = mobile ? 0 : start.offsetTop
    const x1 = mobile ? end.offsetLeft : 0
    const y1 = mobile ? 0 : end.offsetTop
    const direction = index > previous ? 1 : -1
    const animation = marker.current.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(1)` },
      { transform: `translate(${x1 + (mobile ? direction * 4 : 0)}px, ${y1 + (mobile ? 0 : direction * 4)}px) scale(1.02, .98)`, offset: .7 },
      { transform: `translate(${x1}px, ${y1}px) scale(1)` },
    ], { duration: 480, easing: 'cubic-bezier(.22,.8,.3,1)' })
    return () => animation.cancel()
  }, [active, index])
  const items = [
    { id: 'home' as const, label: 'Trang chủ', href: '/home', Icon: Home },
    { id: 'saved' as const, label: 'Đã lưu', href: '/home?saved=1', Icon: Bookmark },
    { id: 'following' as const, label: 'Đang theo dõi', href: '/following', Icon: Users },
  ]
  return <nav className={styles.nav} style={{ '--selected-index': index } as CSSProperties} aria-label="Điều hướng chính">
    {active && <div ref={marker} className={styles.marker} aria-hidden="true" />}
    {items.map(({ id, label, href, Icon }) => {
      const content = <><Icon size={19} aria-hidden="true" /><span className={styles.label}>{label}</span>{id === 'saved' && <small>{savedCount}</small>}</>
      return onSelect
        ? <button key={id} type="button" className={styles.item} aria-pressed={active === id} onClick={() => onSelect(id)} title={label}>{content}</button>
        : <Link key={id} className={styles.item} href={href} aria-current={active === id ? 'page' : undefined} title={label}>{content}</Link>
    })}
  </nav>
}

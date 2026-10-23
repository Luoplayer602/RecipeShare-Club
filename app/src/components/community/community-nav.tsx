'use client'

import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bookmark, Home, Users, UserRound } from 'lucide-react'
import styles from './community-nav.module.css'

type View = 'home' | 'saved' | 'following'
export function CommunityNav({ active, savedCount, onSelect, profileHref = '/profile' }: { active?: View; savedCount?: number; onSelect?: (view: View) => void; profileHref?: string }) {
  const marker = useRef<HTMLDivElement>(null)
  const transition = useRef<{ target: number; from: number; entering: boolean } | null>(null)
  const isProfile = usePathname().startsWith('/profile')
  const selected = isProfile ? 'profile' : active
  const index = isProfile ? 3 : active === 'following' ? 2 : active === 'saved' ? 1 : 0
  useLayoutEffect(() => {
    if (!selected) return
    const sameTarget = transition.current?.target === index
    const first = transition.current === null || Boolean(sameTarget && transition.current?.entering)
    const previous = sameTarget ? transition.current!.from : transition.current?.target ?? index
    transition.current = { target: index, from: previous, entering: first }
    if (!marker.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
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
    if (!first && previous === index) return
    const entrance = -marker.current.parentElement!.getBoundingClientRect().left - marker.current.offsetWidth - 28
    const animation = marker.current.animate(first ? [
      { opacity: 0, transform: `translate(${entrance}px, ${y1}px) scale(.9,1.08)` },
      { opacity: 1, transform: `translate(${x1 + 12}px, ${y1}px) scale(1.07,.94)`, offset: .58 },
      { transform: `translate(${x1 - 5}px, ${y1}px) scale(.98,1.025)`, offset: .79 },
      { transform: `translate(${x1 + 2}px, ${y1}px) scale(1.01,.99)`, offset: .92 },
      { opacity: 1, transform: `translate(${x1}px, ${y1}px) scale(1)` },
    ] : [
      { transform: `translate(${x0}px, ${y0}px) scale(1)` },
      { transform: `translate(${x1 + (mobile ? direction * 4 : 0)}px, ${y1 + (mobile ? 0 : direction * 4)}px) scale(1.02,.98)`, offset: .7 },
      { transform: `translate(${x1}px, ${y1}px) scale(1)` },
    ], { duration: first ? 800 : 480, easing: 'cubic-bezier(.22,.8,.3,1)' })
    return () => animation.cancel()
  }, [selected, index])
  const items = [
    { id: 'home' as const, label: 'Trang chủ', href: '/home', Icon: Home },
    { id: 'saved' as const, label: 'Đã lưu', href: '/home?saved=1', Icon: Bookmark },
    { id: 'following' as const, label: 'Đang theo dõi', href: '/home?view=following', Icon: Users },
  ]
  return <nav className={styles.nav} style={{ '--selected-index': index } as CSSProperties} aria-label="Điều hướng chính">
    {selected && <div ref={marker} className={styles.marker} aria-hidden="true" />}
    {items.map(({ id, label, href, Icon }) => {
      const content = <><Icon size={19} aria-hidden="true" /><span className={styles.label}>{label}</span>{id === 'saved' && typeof savedCount === 'number' && <small>{savedCount}</small>}</>
      return onSelect
        ? <button key={id} type="button" className={styles.item} aria-pressed={active === id} onClick={() => onSelect(id)} title={label}>{content}</button>
        : <Link key={id} className={styles.item} href={href} aria-current={active === id ? 'page' : undefined} title={label}>{content}</Link>
    })}
    <Link className={styles.item} href={profileHref} prefetch={false} aria-current={isProfile ? 'page' : undefined} title="Trang cá nhân"><UserRound size={19} aria-hidden="true" /><span className={styles.label}>Trang cá nhân</span></Link>
  </nav>
}

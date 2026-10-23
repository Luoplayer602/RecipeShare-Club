'use client'
import { useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChefHat, Search, Utensils, X } from 'lucide-react'
import { InteractiveAmbient } from '@/components/interactive-ambient'
import { AccountArea } from './account-area'
import { CommunityNav } from './community-nav'
import { CommunityShellContext } from './shell-context'
import type { SessionUser } from './types'
import styles from './shell.module.css'

export type CommunityView = 'home' | 'saved' | 'following'
export type CommunityFrameProps = {
  rightPanel?: ReactNode; className?: string;
  user: SessionUser | null; children: ReactNode; active?: CommunityView;
  onSelect?: (view: CommunityView) => void; query?: string; onQuery?: (value: string) => void;
}
export function CommunityFrame(props: CommunityFrameProps) {
  const update = useContext(CommunityShellContext)
  useLayoutEffect(() => {
    if (update) {
      const { children: _, ...settings } = props
      void _
      update(settings)
    }
  })
  return update ? <>{props.children}</> : <StandaloneCommunityFrame {...props} />
}
export function StandaloneCommunityFrame({ user, children, active, onSelect, query, onQuery, rightPanel, className = '' }: CommunityFrameProps) {
  const [search, setSearch] = useState('')
  const [savedCount, setSavedCount] = useState<number | undefined>()
  useEffect(() => {
    const controller = new AbortController()
    let generation = 0
    async function read() {
      const current = ++generation
      if (!user) { setSavedCount(undefined); return }
      try {
        const response = await fetch('/api/saved-posts', { cache: 'no-store', signal: controller.signal })
        if (!response.ok) return
        const data = await response.json()
        if (!controller.signal.aborted && current === generation) setSavedCount(data.total)
      } catch { /* Count can retry on the next save or focus. */ }
    }
    void read(); window.addEventListener('saved-post-changed', read); window.addEventListener('focus', read)
    return () => { controller.abort(); window.removeEventListener('saved-post-changed', read); window.removeEventListener('focus', read) }
  }, [user])
  return <div className={`${styles.page} ${className}`}>
    <InteractiveAmbient className="ambient-one" /><InteractiveAmbient className="ambient-two" /><InteractiveAmbient className="ambient-three" />
    <header className={styles.header}>
      <Link href="/home" className={styles.logo} onClick={onSelect ? event => { event.preventDefault(); onSelect('home') } : undefined}><Image src="/icons/logo.png" alt="" width={48} height={48} unoptimized priority /><span>RecipeShare<small>CLUB</small></span></Link>
      <form action="/home" className={styles.search} onSubmit={onQuery ? event => event.preventDefault() : undefined}><Search size={19} aria-hidden="true" /><input name="q" aria-label="Tìm bài viết" placeholder="Tìm món ăn bạn yêu thích…" value={onQuery ? query : search} onChange={event => onQuery ? onQuery(event.target.value) : setSearch(event.target.value)} />{(onQuery ? query : search) && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => onQuery ? onQuery('') : setSearch('')}><X size={16} /></button>}</form>
      <div className={styles.account}><AccountArea user={user} /></div>
    </header>
    <div className={styles.layout}>
      <aside className={styles.sidebar}><CommunityNav savedCount={user ? savedCount : undefined} active={active} onSelect={onSelect} profileHref={user ? `/profile/${encodeURIComponent(user.username)}` : '/'} /><div className={styles.sidebarNote}><Utensils size={25} /><p>Mỗi món ăn,<br />một câu chuyện.</p><small>Cùng nhau chia sẻ niềm vui vào bếp.</small></div></aside>
      {children}
      <aside className={styles.rightPanel}>{rightPanel ?? <><div className={styles.community}><ChefHat size={36} /><p>CHÀO MỪNG ĐẾN VỚI CLUB</p><h2>Hôm nay,<br />bạn nấu món gì?</h2><p>Khám phá những công thức và câu chuyện từ cộng đồng yêu căn bếp.</p></div><small className={styles.demoNote}>RecipeShare Club<br />Nơi căn bếp kết nối những câu chuyện.</small></>}</aside>
    </div>
  </div>
}

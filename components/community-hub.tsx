'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AutoTextarea } from '@/components/auto-textarea'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ChefHat, Plus, Search, Utensils, X } from 'lucide-react'
import styles from '@/app/home/page.module.css'
import { FollowingContent } from './following-content'
import { PaginatedRecipes } from '@/components/paginated-recipes'
import { InteractiveAmbient } from '@/components/interactive-ambient'
import { categories, recipes } from '@/lib/recipes'
import { AccountMenu } from '@/components/account-menu'
import { CommunityNav } from '@/components/community-nav'
import { useSavedRecipes } from '@/lib/use-saved-recipes'

export function CommunityHub() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(categories[0])
  const [view, setView] = useState<'home' | 'saved' | 'following'>('home')
  const savedOnly = view === 'saved'
  const [navigationReady, setNavigationReady] = useState(false)
  const [saved, toggleSave] = useSavedRecipes()
  const [creating, setCreating] = useState(false)
  const [createCounts, setCreateCounts] = useState({ title: 0, excerpt: 0 })
  const [notice, setNotice] = useState('')
  const createDialog = useRef<HTMLDialogElement>(null)
  const createSource = useRef<HTMLButtonElement | null>(null)
  const popupAnimation = useRef<Animation | null>(null)
  const closePending = useRef(false)
  const [closingCreate, setClosingCreate] = useState(false)

  function popupFrames() {
    const dialog = createDialog.current
    const source = createSource.current
    if (!dialog || !source) return null
    const from = source.getBoundingClientRect()
    const to = dialog.getBoundingClientRect()
    return {
      x: from.left + from.width / 2 - to.left - to.width / 2,
      y: from.top + from.height / 2 - to.top - to.height / 2,
      scale: Math.max(.18, Math.min(.5, from.width / to.width)),
    }
  }
  function openCreate(source: HTMLButtonElement) {
    if (createDialog.current?.open) return
    createSource.current = source
    closePending.current = false
    setClosingCreate(false)
    setCreateCounts({ title: 0, excerpt: 0 })
    setCreating(true)
    createDialog.current?.showModal()
  }
  useLayoutEffect(() => {
    if (!creating || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const from = popupFrames()
    if (!from || !createDialog.current) return
    // Sample one continuous damped spring; no separate easing segment at the rebound.
    const response = (t: number) => 1 - Math.exp(-8.4 * t) * (Math.cos(8.8 * t) + (8.4 / 8.8) * Math.sin(8.8 * t))
    const end = response(1)
    const frames = Array.from({ length: 61 }, (_, index) => {
      const t = index / 60
      const progress = index === 60 ? 1 : response(t) / end
      const scale = from.scale + (1 - from.scale) * progress
      const jelly = .012 * Math.sin(t * Math.PI * 4) * Math.sin(t * Math.PI) * Math.exp(-2.8 * t)
      return {
        offset: t,
        transform: `translate3d(${from.x * (1 - progress)}px, ${from.y * (1 - progress)}px, 0) scale(${scale * (1 + jelly)}, ${scale * (1 - jelly)})`,
        opacity: Math.min(1, .25 + progress * 1.8),
      }
    })
    const animation = createDialog.current.animate(frames, { duration: 700, easing: 'linear' })
    popupAnimation.current = animation
    return () => animation.cancel()
  }, [creating])
  async function closeCreate() {
    if (closePending.current) return
    closePending.current = true
    const computed = createDialog.current ? getComputedStyle(createDialog.current) : null
    const currentFrame = { transform: computed?.transform ?? 'none', opacity: computed?.opacity ?? '1' }
    popupAnimation.current?.cancel()
    setClosingCreate(true)
    const to = popupFrames()
    if (to && createDialog.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const animation = createDialog.current.animate([
        currentFrame,
        { transform: `translate3d(${to.x}px, ${to.y}px, 0) scale(${to.scale})`, opacity: 0 },
      ], { duration: 300, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' })
      popupAnimation.current = animation
      try { await animation.finished } catch { return }
    }
    createDialog.current?.close()
    popupAnimation.current?.cancel()
    closePending.current = false
    setClosingCreate(false)
  }
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase()
  const visible = recipes.filter(recipe => (!savedOnly || saved.includes(recipe.id)) && (category === categories[0] || recipe.tags.includes(category)) && normalize(`${recipe.title} ${recipe.author} ${recipe.tags.join(' ')}`).includes(normalize(query)))

  useEffect(() => {
    function restoreLocation() {
      const params = new URLSearchParams(window.location.search)
      setQuery(params.get('q') ?? '')
      const filter = params.get('category')
      setCategory(filter && categories.includes(filter) ? filter : categories[0])
      setView(window.location.pathname === '/following' ? 'following' : params.get('saved') === '1' ? 'saved' : 'home')
      setNavigationReady(true)
    }
    restoreLocation()
    window.addEventListener('popstate', restoreLocation)
    return () => window.removeEventListener('popstate', restoreLocation)
  }, [])

  function selectView(next: 'home' | 'saved' | 'following') {
    setView(next)
    setCategory(categories[0])
    setQuery('')
    const url = next === 'following' ? '/following' : next === 'saved' ? '/home?saved=1' : '/home'
    if (window.location.pathname + window.location.search !== url) window.history.pushState(null, '', url)
  }

  return <div className={styles.page}>
    <InteractiveAmbient className="ambient-one" />
    <InteractiveAmbient className="ambient-two" />
    <InteractiveAmbient className="ambient-three" />
    <header className={styles.header}>
      <Link href="/home" className={styles.logo}><Image src="/icons/logo.png" alt="" width={48} height={48} priority unoptimized /><span>RecipeShare<small>CLUB</small></span></Link>
      <label className={styles.search}><Search size={19} aria-hidden="true" /><input aria-label="Tìm món ăn" placeholder="Tìm món ăn, người chia sẻ…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}><X size={16} /></button>}</label>
      <div className={styles.account}><button className={styles.createButton} aria-label="Chia sẻ món ngon" onClick={event => openCreate(event.currentTarget)}><span>Chia sẻ món ngon</span> <Plus size={18} /></button><AccountMenu /></div>
    </header>
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <CommunityNav active={navigationReady ? view : undefined} savedCount={saved.length} onSelect={selectView} />
        <div className={styles.sidebarNote}><Utensils size={25} /><p>Mỗi món ăn,<br />một câu chuyện.</p><small>Cùng nhau chia sẻ niềm vui vào bếp.</small></div>
      </aside>
      <main className={styles.feed}>
        {view === 'following' ? <FollowingContent query={query} clearQuery={() => setQuery('')} /> : <>
        <div className={styles.welcome}><p>CHÀO BẠN, MỪNG BẠN GHÉ BẾP</p><h1>Một chút cảm hứng,<br /><em>một bữa ăn ngon.</em></h1><span>Khám phá những công thức gần gũi từ cộng đồng yêu nấu ăn.</span></div>
        <nav className={styles.categories} aria-label="Danh mục món ăn">{categories.map(item => <button key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</nav>
        <div className={styles.feedHeading}><h2>{savedOnly ? 'Món ăn đã lưu' : category}</h2><span>{visible.length} công thức để thử</span></div>
        <PaginatedRecipes filterKey={`${query}:${category}:${savedOnly}`} recipes={visible} saved={saved} toggleSave={toggleSave} onTag={setCategory} />
        {!visible.length && <div className={styles.empty}><Search size={32} /><h2>Chưa có món ăn phù hợp</h2><p>Thử từ khóa khác hoặc khám phá tất cả món ăn.</p><button onClick={() => { setQuery(''); setCategory(categories[0]); selectView('home') }}>Xem tất cả</button></div>}
        </>}
      </main>
      <aside className={styles.rightPanel}>
        <div className={styles.community}><ChefHat size={36} /><p>CHÀO MỪNG ĐẾN VỚI CLUB</p><h2>Hôm nay,<br />bạn nấu món gì?</h2><p>Một công thức nhỏ có thể mang đến cảm hứng cho rất nhiều căn bếp.</p><button onClick={event => openCreate(event.currentTarget)}>Chia sẻ công thức <Plus size={16} /></button></div>
        <div className={styles.topics}><h3>Khám phá hương vị</h3>{categories.slice(1).map((tag, index) => <button key={tag} onClick={() => { selectView('home'); setCategory(tag) }}><span>0{index + 1}</span>{tag}<span>↗</span></button>)}</div>
        <small className={styles.demoNote}>RecipeShare Club<br />Nơi căn bếp kết nối những câu chuyện.</small>
      </aside>
    </div>
    <p className={styles.status} role="status">{notice}</p>
    <dialog ref={createDialog} className={styles.dialog} data-closing={closingCreate} onCancel={event => { event.preventDefault(); void closeCreate() }} onClose={() => setCreating(false)}><button className={styles.closeDialog} aria-label="Đóng tạo công thức" onClick={() => void closeCreate()}><X /></button>{creating && <form className={styles.draftForm} onSubmit={async event => { event.preventDefault(); const form = new FormData(event.currentTarget); try { sessionStorage.setItem('recipeshare-create', JSON.stringify({ title: String(form.get('title') || ''), excerpt: String(form.get('description') || '') })) } catch { /* Navigation remains available if browser storage is disabled. */ } await closeCreate(); router.push('/editor') }}><p>GÓC BẾP CỦA BẠN</p><h2>Chia sẻ một món ngon</h2><label>Tên món ăn<input name="title" maxLength={200} onChange={event => setCreateCounts(current => ({ ...current, title: event.target.value.length }))} placeholder="Ví dụ: Bánh mì trứng nhà làm" /><small className={styles.charCount}>{createCounts.title}/200</small></label><label>Câu chuyện món ăn<AutoTextarea name="description" maxLength={500} onChange={event => setCreateCounts(current => ({ ...current, excerpt: event.target.value.length }))} rows={4} placeholder="Kể một chút về công thức của bạn…" /><small className={styles.charCount}>{createCounts.excerpt}/500</small></label><button type="submit" className={styles.createButton}>Tạo và mở editor</button></form>}</dialog>
  </div>
}

'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { ChefLoader } from '@/components/chef-loader'
import { EditorCollapse } from '@/components/editor-collapse'
import { PaginatedPosts } from './paginated-posts'
import { CommunityFrame, type CommunityView } from './frame'
import type { PostList, SessionUser } from './types'
import styles from './shell.module.css'
import extra from './integration.module.css'

type Filters = { q: string; type: string; tag: string; page: number; view: CommunityView }
const initial: Filters = { q: '', type: '', tag: '', page: 1, view: 'home' }
export function CommunityHome({ user }: { user: SessionUser | null }) {
  const [filters, setFilters] = useState(initial)
  const [ready, setReady] = useState(false)
  const [result, setResult] = useState<PostList | null>(null)
  const catalog = result?.popularTags ?? []
  const [pending, setPending] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const feed = useRef<HTMLElement>(null)
  useEffect(() => {
    function read() {
      const params = new URLSearchParams(location.search)
      const type = params.get('type') ?? ''
      const page = Number(params.get('page') ?? 1)
      setFilters({ q: params.get('q') ?? '', type: ['recipe', 'blog'].includes(type) ? type : '', tag: params.get('tag') ?? '', page: Number.isSafeInteger(page) && page > 0 ? page : 1, view: params.get('view') === 'following' ? 'following' : params.get('saved') === '1' ? 'saved' : 'home' })
      setReady(true)
    }
    read(); window.addEventListener('popstate', read)
    return () => window.removeEventListener('popstate', read)
  }, [])
  function select(update: Partial<Filters>) {
    const next = { ...filters, page: 1, ...update }
    setFilters(next)
    if (next.view === 'home') setPending(true)
    const params = new URLSearchParams()
    if (next.q) params.set('q', next.q)
    if (next.type) params.set('type', next.type)
    if (next.tag) params.set('tag', next.tag)
    if (next.page > 1) params.set('page', String(next.page))
    if (next.view === 'saved') params.set('saved', '1')
    if (next.view === 'following') params.set('view', 'following')
    window.history.pushState(null, '', `/home${params.size ? `?${params}` : ''}`)
  }
  useEffect(() => {
    if (!ready || filters.view !== 'home') return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setPending(true); setError('')
      try {
        const params = new URLSearchParams({ page: String(filters.page), limit: '10' })
        if (filters.q) params.set('q', filters.q)
        if (filters.type) params.set('type', filters.type)
        if (filters.tag) params.set('tag', filters.tag)
        const response = await fetch(`/api/posts?${params}`, { signal: controller.signal, cache: 'no-store' })
        if (!response.ok) throw new Error('Không tải được bài viết. Vui lòng thử lại.')
        const data: PostList = await response.json()
        if (controller.signal.aborted) return
        setResult(data)
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Không kết nối được máy chủ.')
      } finally { if (!controller.signal.aborted) setPending(false) }
    }, 200)
    return () => { clearTimeout(timer); controller.abort() }
  }, [ready, filters, retry])
  return <CommunityFrame user={user} active={ready ? filters.view : undefined} query={filters.q} onQuery={q => select({ q })} onSelect={view => select({ ...initial, view })}>
    <main ref={feed} className={styles.feed}>
      {filters.view !== 'home' ? <div className={styles.empty}><h1>{filters.view === 'saved' ? 'Bài viết đã lưu' : 'Đang theo dõi'}</h1><p>{user ? 'Chức năng này sẽ sớm có mặt.' : 'Đăng nhập để lưu bài và theo dõi tác giả.'}</p>{!user && <Link className={styles.createButton} href="/">Đăng nhập</Link>}</div> : <>
        <div className={styles.welcome}><p>CHÀO BẠN, MỪNG BẠN GHÉ BẾP</p><h1>Một chút cảm hứng,<br /><em>một bữa ăn ngon.</em></h1><span>Khám phá công thức và câu chuyện từ cộng đồng yêu nấu ăn.</span></div>
        <nav className={styles.categories} aria-label="Lọc loại bài">{[['', 'Dành cho bạn'], ['recipe', 'Công thức'], ['blog', 'Chuyện trong bếp']].map(([type, label]) => <button key={type} aria-pressed={filters.type === type} onClick={() => select({ type })}>{label}</button>)}</nav>
        {(catalog.length > 0 || filters.tag) && <nav className={`${styles.categories} ${extra.hotTags}`} aria-label="Nhãn phổ biến">
          <button aria-pressed={!filters.tag} onClick={() => select({ tag: '' })}>Tất cả nhãn</button>
          {filters.tag && !catalog.some(tag => tag.slug === filters.tag) && <button aria-pressed title="Bỏ lọc nhãn" onClick={() => select({ tag: '' })}><span className={extra.hotTagName}>{result?.selectedTag?.slug === filters.tag ? result.selectedTag.name : filters.tag}</span> ×</button>}
          {catalog.map(tag => <button key={tag.id} aria-pressed={filters.tag === tag.slug} title={`${tag.name} · ${tag.postCount} bài viết`} onClick={() => select({ tag: tag.slug })}><span className={extra.hotTagName}>{tag.name}</span><small>{tag.postCount}</small></button>)}
        </nav>}
        <div className={styles.feedHeading}><h2>{filters.q ? 'Kết quả tìm kiếm' : 'Món mới từ cộng đồng'}</h2><span aria-live="polite">{pending ? result ? <ChefLoader mode="inline" /> : '' : `${result?.pagination.total ?? 0} bài viết`}</span></div>
        {error ? <div className={styles.empty} role="alert"><h2>Chưa thể mở căn bếp</h2><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>Thử lại</button></div> : <div aria-busy={pending}>
          {!result && <ChefLoader />}
          <EditorCollapse open={Boolean(result && !result.posts.length)}><div className={styles.empty} role="status"><Search size={30} /><h2>Chưa có bài viết phù hợp</h2><p>Thử từ khóa hoặc nhãn khác.</p><button onClick={() => select(initial)}>Xem tất cả</button></div></EditorCollapse>
          <PaginatedPosts result={result} pending={pending} filterKey={`${filters.q}:${filters.type}:${filters.tag}`} onPage={page => select({ page })} onTag={tag => select({ tag })} />

        </div>}
      </>}
    </main>
  </CommunityFrame>
}

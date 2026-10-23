'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bookmark, Search } from 'lucide-react'
import { ChefLoader } from '@/components/chef-loader'
import { EditorCollapse } from '@/components/editor-collapse'
import { PaginatedPosts } from './paginated-posts'
import { CommunityFrame, type CommunityView } from './frame'
import type { PostList, SessionUser } from './types'
import styles from './shell.module.css'
import { TagFilter } from './tag-filter'

type Filters = { q: string; type: string; tag: string; pinned: string[]; page: number; view: CommunityView }
const initial: Filters = { q: '', type: '', tag: '', pinned: [], page: 1, view: 'home' }
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
      setFilters({ q: params.get('q') ?? '', type: params.get('saved') === '1' ? '' : ['recipe', 'blog'].includes(type) ? type : '', tag: params.get('tag') ?? '', pinned: [...new Set((params.get('tags') ?? '').split(',').filter(Boolean))].slice(0, 10), page: Number.isSafeInteger(page) && page > 0 ? page : 1, view: params.get('view') === 'following' ? 'following' : params.get('saved') === '1' ? 'saved' : 'home' })
      setReady(true)
    }
    read(); window.addEventListener('popstate', read)
    return () => window.removeEventListener('popstate', read)
  }, [])
  function select(update: Partial<Filters>) {
    const next = { ...filters, page: 1, ...update }
    setFilters(next)
    if (next.view !== 'following') setPending(true)
    const params = new URLSearchParams()
    if (next.q) params.set('q', next.q)
    if (next.type) params.set('type', next.type)
    if (next.tag) params.set('tag', next.tag)
    if (next.pinned.length) params.set('tags', next.pinned.join(','))
    if (next.page > 1) params.set('page', String(next.page))
    if (next.view === 'saved') params.set('saved', '1')
    if (next.view === 'following') params.set('view', 'following')
    window.history.pushState(null, '', `/home${params.size ? `?${params}` : ''}`)
  }
  useEffect(() => {
    if (!ready || filters.view === 'following' || (filters.view === 'saved' && !user)) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setPending(true); setError('')
      try {
        const params = new URLSearchParams({ page: String(filters.page), limit: '10' })
        if (filters.view === 'saved') params.set('saved', '1')
        if (filters.q) params.set('q', filters.q)
        if (filters.view !== 'saved' && filters.type) params.set('type', filters.type)
        if (filters.pinned.length) params.set('tags', filters.pinned.join(','))
        if (filters.tag) params.set('tag', filters.tag)
        const response = await fetch(`/api/posts?${params}`, { signal: controller.signal, cache: 'no-store' })
        if (!response.ok) throw new Error('Không tải được bài viết. Vui lòng thử lại.')
        const data: PostList = await response.json()
        if (controller.signal.aborted) return
        if (filters.page > 1 && !data.posts.length) { setFilters(previous => ({ ...previous, page: Math.max(1, data.pagination.totalPages) })); const url = new URL(location.href); url.searchParams.set('page', String(Math.max(1, data.pagination.totalPages))); window.history.replaceState(null, '', url); return }
        setResult(data)
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Không kết nối được máy chủ.')
      } finally { if (!controller.signal.aborted) setPending(false) }
    }, 200)
    return () => { clearTimeout(timer); controller.abort() }
  }, [ready, filters, retry, user])
  useEffect(() => {
    function refresh() { if (filters.view === 'saved') setRetry(value => value + 1) }
    window.addEventListener('saved-post-changed', refresh)
    return () => window.removeEventListener('saved-post-changed', refresh)
  }, [filters.view])
  return <CommunityFrame user={user} active={ready ? filters.view : undefined} query={filters.q} onQuery={q => select({ q })} onSelect={view => select({ ...initial, view })}>
    <main ref={feed} className={styles.feed}>
      {filters.view === 'following' || (filters.view === 'saved' && !user) ? <div className={styles.empty}><h1>{filters.view === 'saved' ? 'Bài viết đã lưu' : 'Đang theo dõi'}</h1><p>{user ? 'Chức năng này sẽ sớm có mặt.' : 'Đăng nhập để lưu bài và theo dõi tác giả.'}</p>{!user && <Link className={styles.createButton} href="/">Đăng nhập</Link>}</div> : <>
        <div className={styles.welcome} key={filters.view}><p>{filters.view === 'saved' ? 'GIỮ LẠI CẢM HỨNG VÀO BẾP' : 'CHÀO BẠN, MỪNG BẠN GHÉ BẾP'}</p><h1>{filters.view === 'saved' ? <>Món ngon đã lưu,<br /><em>để dành hôm nào nấu.</em></> : <>Một chút cảm hứng,<br /><em>một bữa ăn ngon.</em></>}</h1><span>{filters.view === 'saved' ? 'Những công thức và câu chuyện bạn yêu thích, xếp theo lần lưu gần nhất.' : 'Khám phá công thức và câu chuyện từ cộng đồng yêu nấu ăn.'}</span></div>
        {filters.view !== 'saved' && <nav className={styles.categories} aria-label="Lọc loại bài">{[['', 'Dành cho bạn'], ['recipe', 'Công thức'], ['blog', 'Chuyện trong bếp']].map(([type, label]) => <button key={type} aria-pressed={filters.type === type} onClick={() => select({ type })}>{label}</button>)}</nav>}
        <TagFilter catalog={catalog} selectedTags={result?.selectedTags ?? (result?.selectedTag ? [result.selectedTag] : [])} current={filters.tag} pinned={filters.pinned} onChange={(tag, pinned) => select({ tag, pinned })} />
        <div className={styles.feedHeading}><h2>{filters.q ? 'Kết quả tìm kiếm' : filters.view === 'saved' ? 'Bài viết đã lưu' : 'Món mới từ cộng đồng'}</h2><span aria-live="polite">{pending ? result ? <ChefLoader mode="inline" /> : '' : `${result?.pagination.total ?? 0} bài viết`}</span></div>
        {error ? <div className={styles.empty} role="alert"><h2>Chưa thể mở căn bếp</h2><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>Thử lại</button></div> : <div aria-busy={pending}>
          {!result && <ChefLoader />}
          <EditorCollapse open={Boolean(result && !result.posts.length)}><div className={styles.empty} role="status">{filters.view === 'saved' && !filters.q && !filters.type && !filters.tag && !filters.pinned.length ? <Bookmark size={30} /> : <Search size={30} />}<h2>{filters.view === 'saved' && !filters.q && !filters.type && !filters.tag && !filters.pinned.length ? 'Để dành một món ngon cho lần tới' : 'Chưa có bài viết phù hợp'}</h2><p>{filters.view === 'saved' && !filters.q && !filters.type && !filters.tag && !filters.pinned.length ? 'Nhấn biểu tượng lưu trên bài viết để gom những công thức bạn muốn thử.' : 'Thử từ khóa hoặc nhãn khác.'}</p><button onClick={() => select({ ...initial, view: filters.view === 'saved' && (filters.q || filters.type || filters.tag || filters.pinned.length) ? 'saved' : 'home' })}>{filters.view === 'saved' && (filters.q || filters.type || filters.tag || filters.pinned.length) ? 'Xem tất cả bài đã lưu' : 'Khám phá món ngon'}</button></div></EditorCollapse>
          <PaginatedPosts key={user?.id ?? 'guest'} result={result} pending={pending} filterKey={`${filters.view}:${filters.q}:${filters.type}:${filters.tag}:${filters.pinned.join(',')}`} onPage={page => select({ page })} onTag={tag => select({ tag })} />

        </div>}
      </>}
    </main>
  </CommunityFrame>
}

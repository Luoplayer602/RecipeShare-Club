'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Users, ChevronDown, Search, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { EditorCollapse } from '@/components/editor-collapse'
import { ChefLoader } from '@/components/chef-loader'
import { PaginatedPosts } from './paginated-posts'
import { FollowAuthor } from './follow-author'
import type { PostList } from './types'
import shell from './shell.module.css'
import styles from './following.module.css'

type Author = { id: string; username: string; displayName: string; titleName: string; avatarUrl: string | null; postCount: number; followerCount: number }
type Directory = { totalFollowing: number; authors: Author[]; suggestions: Author[]; pagination: { page: number; total: number; totalPages: number } }
function Avatar({ author }: { author: Author }) { return <span className={styles.avatar}>{author.avatarUrl ? <Image src={author.avatarUrl} alt="" width={48} height={48} unoptimized /> : author.displayName.slice(0, 1).toUpperCase()}</span> }
export function FollowingContent({ query, clearQuery }: { query: string; clearQuery: () => void }) {
  const router = useRouter()
  const [listOpen, setListOpen] = useState(false)
  const [authorQuery, setAuthorQuery] = useState('')
  const [directoryPage, setDirectoryPage] = useState(1)
  const [directory, setDirectory] = useState<Directory | null>(null)
  const [directoryBusy, setDirectoryBusy] = useState(true)
  const [directoryError, setDirectoryError] = useState('')
  const [page, setPage] = useState(1)
  const [previousQuery, setPreviousQuery] = useState(query)
  if (query !== previousQuery) { setPreviousQuery(query); setPage(1) }
  const [result, setResult] = useState<PostList | null>(null)
  const [pending, setPending] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    function refresh() { setRevision(value => value + 1) }
    window.addEventListener('follow-changed', refresh); window.addEventListener('focus', refresh)
    return () => { window.removeEventListener('follow-changed', refresh); window.removeEventListener('focus', refresh) }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setPending(true); setError('')
      try {
        const response = await fetch(`/api/posts?${new URLSearchParams({ following: '1', q: query, page: String(page), limit: '10' })}`, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error(response.status === 401 ? 'Phiên đăng nhập đã hết. Hãy đăng nhập lại.' : 'Chưa thể tải bài viết. Vui lòng thử lại.')
        const data: PostList = await response.json()
        if (controller.signal.aborted) return
        if (page > 1 && !data.posts.length) { setPage(Math.max(1, data.pagination.totalPages)); return }
        setResult(data)
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Không kết nối được máy chủ.') }
      finally { if (!controller.signal.aborted) setPending(false) }
    }, 200)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, page, revision])
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setDirectoryBusy(true); setDirectoryError('')
      try {
        const response = await fetch(`/api/following?${new URLSearchParams({ q: authorQuery, page: String(directoryPage) })}`, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error()
        const data: Directory = await response.json()
        if (controller.signal.aborted) return
        if (directoryPage > 1 && !data.authors.length) { setDirectoryPage(Math.max(1, data.pagination.totalPages)); return }
        setDirectory(data)
      } catch { if (!controller.signal.aborted) setDirectoryError('Chưa tải được danh sách bếp. Vui lòng thử lại.') }
      finally { if (!controller.signal.aborted) setDirectoryBusy(false) }
    }, 150)
    return () => { clearTimeout(timer); controller.abort() }
  }, [authorQuery, directoryPage, revision])
  return <>
    <div className={shell.welcome}><p>GÓC BẾP QUEN THUỘC</p><h1>Mỗi căn bếp quen,<br /><em>thêm một món ngon.</em></h1><span>Những bài viết mới nhất từ các bếp bạn theo dõi.</span></div>
    <div className={styles.toolbar}><span><Users size={16} />{directory ? `${directory.totalFollowing} bếp đang theo dõi` : 'Những căn bếp bạn chọn'}</span><button type="button" className={styles.listToggle} aria-expanded={listOpen} aria-controls="followed-kitchens" onClick={() => setListOpen(value => !value)}><Users size={16} />Danh sách bếp đã theo dõi<ChevronDown size={16} className={listOpen ? styles.rotated : ''} /></button></div>
    <EditorCollapse open={listOpen}><section id="followed-kitchens" className={styles.kitchenPanel} aria-label="Danh sách bếp đã theo dõi" aria-busy={directoryBusy}>
      <div className={styles.panelHeading}><div><h2>Những căn bếp bạn chọn</h2><p>Ghé chơi một chút, hoặc điều chỉnh những bếp bạn muốn theo dõi.</p></div><span>{directory?.totalFollowing ?? '—'} bếp</span></div>
      <label className={styles.kitchenSearch}><Search size={16} /><input maxLength={100} value={authorQuery} onChange={event => { setAuthorQuery(event.target.value); setDirectoryPage(1) }} placeholder="Tìm trong danh sách bếp…" aria-label="Tìm bếp đã theo dõi" /></label>
      {directoryError ? <p role="alert">{directoryError}<button onClick={() => setRevision(value => value + 1)}>Thử lại</button></p> : !directory ? <div className={styles.loadingRow}><ChefLoader mode="inline" /></div> : <>
        <div className={styles.kitchens}>{directory.authors.map(author => <div className={styles.kitchen} key={author.id}><Link href={`/profile/${encodeURIComponent(author.username)}`} className={styles.kitchenLink}><Avatar author={author} /><div><strong>{author.displayName}</strong><small>{author.titleName} · {author.postCount} bài viết · {author.followerCount.toLocaleString('vi-VN')} người theo dõi</small></div><ArrowUpRight size={16} /></Link><FollowAuthor username={author.username} initialFollowing /></div>)}</div>
        {!directory.authors.length && !directoryBusy && <p className={styles.hint}>{authorQuery ? 'Chưa tìm thấy bếp phù hợp.' : 'Bạn chưa theo dõi bếp nào. Khám phá những người chia sẻ bên dưới nhé.'}</p>}
        {directory.pagination.totalPages > 1 && <nav className={styles.directoryPages} aria-label="Phân trang bếp đã theo dõi"><button aria-label="Danh sách bếp trước" disabled={directoryBusy || directoryPage <= 1} onClick={() => setDirectoryPage(value => value - 1)}><ChevronLeft size={16} /></button><span>{directoryPage} / {directory.pagination.totalPages}</span><button aria-label="Danh sách bếp tiếp" disabled={directoryBusy || directoryPage >= directory.pagination.totalPages} onClick={() => setDirectoryPage(value => value + 1)}><ChevronRight size={16} /></button></nav>}
      </>}
    </section></EditorCollapse>
    <div className={shell.feedHeading}><h2>Món mới từ căn bếp quen</h2><span>{pending ? <ChefLoader mode="inline" /> : `${result?.pagination.total ?? 0} bài viết · Mới nhất trước`}</span></div>
    {error ? <div className={shell.empty} role="alert"><h2>Chưa thể mở căn bếp</h2><p>{error}</p><button onClick={() => setRevision(value => value + 1)}>Thử lại</button></div> : <div aria-busy={pending}>
      {!result && <ChefLoader />}
      <EditorCollapse open={Boolean(result && !result.posts.length)}><div className={shell.empty}>{query ? <Search size={32} /> : <Users size={32} />}<h2>{query ? 'Chưa có kết quả phù hợp' : directory?.totalFollowing ? 'Những câu chuyện mới đang được viết' : 'Cùng làm quen những căn bếp mới'}</h2><p>{query ? 'Thử tìm tên tác giả, món ăn hoặc nhãn khác.' : directory?.totalFollowing ? 'Các bếp bạn theo dõi chưa có bài viết được xuất bản.' : 'Chọn theo dõi một bếp bên dưới. Bài viết mới của họ sẽ xuất hiện tại đây.'}</p>{query && <button onClick={clearQuery}>Xóa tìm kiếm</button>}</div></EditorCollapse>
      <PaginatedPosts result={result} pending={pending} filterKey={`following:${query}`} onPage={setPage} onTag={tag => router.push(`/home?tag=${encodeURIComponent(tag)}`)} />
    </div>}
    <section className={styles.discover}><h2>Khám phá những căn bếp mới</h2>{directory && <div className={styles.authors}>{directory.suggestions.map(author => <article className={styles.author} key={author.id}><Link href={`/profile/${encodeURIComponent(author.username)}`} className={styles.suggestionLink}><Avatar author={author} /><h3>{author.displayName}</h3></Link><p>{author.postCount} bài viết · {author.followerCount.toLocaleString('vi-VN')} người theo dõi</p><Link href={`/profile/${encodeURIComponent(author.username)}`}>Ghé thăm căn bếp →</Link><FollowAuthor username={author.username} initialFollowing={false} /></article>)}</div>}{directory && !directory.suggestions.length && <p className={styles.hint}>Chưa có bếp mới để gợi ý. Ghé lại sau nhé.</p>}{directoryError && !listOpen && <p role="alert">{directoryError}<button onClick={() => setRevision(value => value + 1)}>Thử lại</button></p>}</section>
  </>
}

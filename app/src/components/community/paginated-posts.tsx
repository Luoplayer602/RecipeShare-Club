'use client'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { PostLink } from './post-navigation'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'
import { SavePostButton } from './save-post-button'
import type { PostList, PostSummary } from './types'
import shell from './shell.module.css'
import extra from './integration.module.css'
import styles from './paginated-posts.module.css'

export function PaginatedPosts({ result, pending, filterKey, onPage, onTag, renderActions }: {
  result: PostList | null; pending: boolean; filterKey: string;
  onPage: (page: number) => void; onTag: (slug: string) => void; renderActions?: (post:PostSummary)=>ReactNode;
}) {
  const [displayed, setDisplayed] = useState(result)
  const [outgoing, setOutgoing] = useState<PostSummary[] | null>(null)
  const [scrolling, setScrolling] = useState(false)
  const scrollFrame = useRef(0)
  const switching = useRef(false)
  const stage = useRef<HTMLDivElement>(null)
  const incoming = useRef<HTMLDivElement>(null)
  const previous = useRef<HTMLDivElement>(null)
  const previousCount = useRef(result?.posts.length ?? 0)
  const [previousFilter, setPreviousFilter] = useState(filterKey)
  // Adjust the snapshot before paint when an API response replaces the visible page.
  if (result !== displayed) {
    setOutgoing(window.matchMedia('(prefers-reduced-motion: reduce)').matches || !displayed?.posts.length ? null : displayed.posts)
    setDisplayed(result)
  }
  if (filterKey !== previousFilter) {
    setPreviousFilter(filterKey)
    setScrolling(false)
  }
  useLayoutEffect(() => {
    cancelAnimationFrame(scrollFrame.current)
    switching.current = false
    return () => cancelAnimationFrame(scrollFrame.current)
  }, [filterKey, result])
  useEffect(() => () => cancelAnimationFrame(scrollFrame.current), [])
  useLayoutEffect(() => {
    const wasEmpty = previousCount.current === 0
    previousCount.current = result?.posts.length ?? 0
    if (!wasEmpty || !result?.posts.length || !incoming.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const animations = Array.from(incoming.current.children).map((card, index) => card.animate([
      { opacity: 0, transform: 'translateY(16px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 450, delay: Math.min(index * 60, 300), easing: 'cubic-bezier(.22,.8,.3,1)', fill: 'backwards' }))
    return () => animations.forEach(animation => animation.cancel())
  }, [result])
  useLayoutEffect(() => {
    if (!outgoing || !stage.current || !incoming.current || !previous.current) return
    const distance = Math.max(stage.current.closest('main')?.clientHeight ?? 0, incoming.current.offsetHeight) + 40
    const animations = [previous.current.animate([
      { transform: 'translateY(0)', opacity: 1 },
      { transform: `translateY(${distance}px)`, opacity: 0 },
    ], { duration: 850, easing: 'cubic-bezier(.35,0,.2,1)', fill: 'both' })]
    Array.from(incoming.current.children).forEach((card, index) => {
      animations.push(card.animate([
        { opacity: 0, transform: 'translateY(-90px) scale(.92)', clipPath: 'inset(0 0 100% 0 round 24px)' },
        { opacity: 1, transform: 'translateY(5px) scale(1.008)', clipPath: 'inset(0 0 0 0 round 24px)', offset: .8 },
        { opacity: 1, transform: 'translateY(0) scale(1)', clipPath: 'inset(0 0 0 0 round 24px)' },
      ], { duration: 650, delay: index * 110, easing: 'cubic-bezier(.22,.7,.25,1)', fill: 'both' }))
    })
    let cancelled = false
    void Promise.all(animations.map(animation => animation.finished)).then(() => {
      if (!cancelled) setOutgoing(null)
    }).catch(() => { /* A new response or unmount can replace this transition. */ })
    return () => { cancelled = true; animations.forEach(animation => animation.cancel()) }
  }, [outgoing])
  function selectPage(next: number) {
    if (!displayed || pending || outgoing || switching.current || next === displayed.pagination.page || next < 1 || next > displayed.pagination.totalPages) return
    const feed = stage.current?.closest('main')
    if (!feed) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finish = () => { switching.current = false; setScrolling(false); onPage(next) }
    const from = feed.scrollTop
    if (reduced || from < 1) { feed.scrollTop = 0; finish(); return }
    switching.current = true; setScrolling(true)
    const start = performance.now()
    const duration = Math.min(1100, 500 + from * .08)
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2
      feed.scrollTop = from * (1 - eased)
      if (progress < 1) scrollFrame.current = requestAnimationFrame(tick)
      else finish()
    }
    scrollFrame.current = requestAnimationFrame(tick)
  }
  function cards(posts: PostSummary[]) {
    return posts.map(post => <article className={shell.card} key={post.id} style={{position:'relative'}}>
      {renderActions&&<div className={styles.tools}>{renderActions(post)}</div>}
      <PostLink postId={post.id} className={shell.food} aria-label={`Xem ${post.title}`}>{post.coverUrl ? <Image className={extra.cover} src={post.coverUrl} alt="" width={420} height={300} unoptimized /> : <span>RecipeShare Club</span>}</PostLink>
      <div className={shell.cardBody}><div className={shell.tags}>{post.tags.map(tag => <button key={tag.id} onClick={() => onTag(tag.slug)}>{tag.name}</button>)}</div><PostLink className={shell.titleButton} postId={post.id}><h2>{post.title}</h2></PostLink><div className={shell.meta}><span>{post.author.displayName}</span><time dateTime={post.publishedAt}>{new Date(post.publishedAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</time></div><p className={shell.description}>{post.excerpt}</p><div className={shell.cardFooter}>{post.recipe ? <span><Clock3 size={15} />Chuẩn bị {post.recipe.prepMinutes ?? '—'}′ · Chế biến {post.recipe.cookMinutes ?? '—'}′</span> : <span>Chuyện trong bếp</span>}<SavePostButton id={post.id} title={post.title} /></div></div>
    </article>)
  }
  const page = displayed?.pagination.page ?? 1
  const total = displayed?.pagination.totalPages ?? 0
  const pages = [...new Set([1, total, page - 2, page - 1, page, page + 1, page + 2])].filter(value => value >= 1 && value <= total).sort((a, b) => a - b)
  const busy = pending || Boolean(outgoing) || scrolling
  return <>
    <div ref={stage} className={styles.stage} aria-busy={busy}>
      {outgoing && <div ref={previous} className={`${shell.cards} ${styles.outgoing}`} aria-hidden="true" inert>{cards(outgoing)}</div>}
      <div ref={incoming} className={`${shell.cards} ${styles.incoming}`} inert={scrolling || Boolean(outgoing)}>{cards(displayed?.posts ?? [])}</div>
    </div>
    {total > 0 && <nav className={styles.pagination} aria-label="Phân trang">
      <button disabled={busy || page <= 1} onClick={() => selectPage(page - 1)} aria-label="Trang trước"><ChevronLeft size={16} /></button>
      {pages.map((value, index) => <span className={styles.pageItem} key={value}>{index > 0 && value - pages[index - 1] > 1 && <span aria-hidden="true">…</span>}<button disabled={busy} aria-label={`Trang ${value}`} aria-current={page === value ? 'page' : undefined} onClick={() => selectPage(value)}>{value}</button></span>)}
      <button disabled={busy || page >= total} onClick={() => selectPage(page + 1)} aria-label="Trang sau"><ChevronRight size={16} /></button>
      <span role="status" aria-live="polite">Trang {page} / {total}</span>
    </nav>}
  </>
}

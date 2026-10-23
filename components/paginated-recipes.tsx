'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bookmark, ChevronLeft, ChevronRight, Clock3, Eye } from 'lucide-react'
import { FoodArt } from './food-art'
import { recipes as sampleRecipes } from '@/lib/recipes'
import shell from '@/app/home/page.module.css'
import styles from './paginated-recipes.module.css'

type Recipe = typeof sampleRecipes[number]
const pageSize = 10

export function PaginatedRecipes({ recipes, filterKey, saved, toggleSave, onTag }: {
  recipes: Recipe[]; filterKey: string; saved: number[]; toggleSave: (id: number) => void; onTag: (tag: string) => void
}) {
  const [displayed, setDisplayed] = useState(recipes)
  const selection = `${filterKey}:${recipes.map(recipe => recipe.id).join(',')}`
  const lastSelection = useRef(selection)
  const [page, setPage] = useState(1)
  const [outgoing, setOutgoing] = useState<Recipe[] | null>(null)
  const [scrolling, setScrolling] = useState(false)
  const scrollFrame = useRef(0)
  const switching = useRef(false)
  const stage = useRef<HTMLDivElement>(null)
  const incoming = useRef<HTMLDivElement>(null)
  const previous = useRef<HTMLDivElement>(null)
  const totalPages = Math.ceil(displayed.length / pageSize)
  const current = displayed.slice((page - 1) * pageSize, page * pageSize)

  useLayoutEffect(() => {
    if (lastSelection.current === selection) return
    lastSelection.current = selection
    cancelAnimationFrame(scrollFrame.current)
    switching.current = false
    setScrolling(false)
    setOutgoing(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? null : current)
    setDisplayed(recipes)
    setPage(1)
  }, [selection, recipes, current])

  useEffect(() => () => cancelAnimationFrame(scrollFrame.current), [])

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
    Promise.all(animations.map(animation => animation.finished)).then(() => {
      if (!cancelled) setOutgoing(null)
    }).catch(() => { /* Cancelling a transition during navigation is expected. */ })
    return () => { cancelled = true; animations.forEach(animation => animation.cancel()) }
  }, [outgoing])

  function selectPage(next: number) {
    if (next === page || next < 1 || next > totalPages || outgoing || switching.current) return
    const feed = stage.current?.closest('main')
    if (!feed) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finish = () => {
      switching.current = false
      setScrolling(false)
      if (!reducedMotion) setOutgoing(current)
      setPage(next)
    }
    const from = feed.scrollTop
    if (reducedMotion || from < 1) { feed.scrollTop = 0; finish(); return }
    switching.current = true
    setScrolling(true)
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

  function cards(items: Recipe[]) {
    return items.map(recipe => <article className={shell.card} key={recipe.id}>
      <Link href={`/posts/${recipe.id}`} className={`${shell.food} ${shell[`food${recipe.artId}`]}`} aria-label={`Xem ${recipe.title}`}><FoodArt kind={recipe.artId} /><small>GÓC BẾP CỘNG ĐỒNG</small></Link>
      <div className={shell.cardBody}><div className={shell.tags}>{recipe.tags.map(tag => <button key={tag} onClick={() => onTag(tag)}>{tag}</button>)}</div>
        <Link href={`/posts/${recipe.id}`} className={shell.titleButton}><h2>{recipe.title}</h2></Link>
        <div className={shell.meta}><span><Eye size={13} />{recipe.views} lượt xem</span><span>{recipe.author}</span><time dateTime="2026-10-20">20.10.2026</time></div>
        <p className={shell.description}>{recipe.description}</p>
        <div className={shell.cardFooter}><span><Clock3 size={15} />{recipe.minutes} phút</span><button aria-pressed={saved.includes(recipe.id)} onClick={() => toggleSave(recipe.id)}><Bookmark size={17} fill={saved.includes(recipe.id) ? 'currentColor' : 'none'} />{saved.includes(recipe.id) ? 'Đã lưu' : 'Lưu món'}</button></div>
      </div>
    </article>)
  }

  if (!displayed.length && !outgoing) return null
  return <>
    <div ref={stage} className={styles.stage} aria-busy={!!outgoing || scrolling}>
      {outgoing && <div ref={previous} className={`${shell.cards} ${styles.outgoing}`} aria-hidden="true" inert>{cards(outgoing)}</div>}
      <div ref={incoming} className={`${shell.cards} ${styles.incoming}`}>{cards(current)}</div>
    </div>
    {totalPages > 0 && <nav className={styles.pagination} aria-label="Phân trang công thức">
      <button disabled={page === 1 || !!outgoing || scrolling} onClick={() => selectPage(page - 1)} aria-label="Trang trước"><ChevronLeft size={16} /></button>
      {Array.from({ length: totalPages }, (_, index) => <button key={index} aria-label={`Trang ${index + 1}`} aria-current={page === index + 1 ? 'page' : undefined} disabled={!!outgoing || scrolling} onClick={() => selectPage(index + 1)}>{index + 1}</button>)}
      <button disabled={page === totalPages || !!outgoing || scrolling} onClick={() => selectPage(page + 1)} aria-label="Trang sau"><ChevronRight size={16} /></button>
      <span role="status" aria-live="polite">Trang {page} / {totalPages}</span>
    </nav>}
  </>
}

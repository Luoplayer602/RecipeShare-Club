'use client'
import { useEffect, useRef } from 'react'
import type { PopularTag, Tag } from './types'
import shell from './shell.module.css'
import styles from './integration.module.css'

type Props = { catalog: PopularTag[]; selectedTags: Tag[]; current: string; pinned: string[]; onChange: (tag: string, pinned: string[]) => void }
function TagButton({ tag, selected, pinned, onSelect, onPin }: { tag: PopularTag; selected: boolean; pinned: boolean; onSelect: () => void; onPin: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const held = useRef(false)
  const moved = useRef(false)
  const cancel = () => { if (timer.current) clearTimeout(timer.current); timer.current = null }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return <button type="button" aria-pressed={selected} data-pinned={pinned} title={`${tag.name} · ${tag.postCount} bài viết. Nhấn giữ hoặc Shift + Enter để ghim lọc nhiều nhãn.`}
    onPointerDown={event => {
      if (!event.isPrimary || event.button !== 0) return
      cancel(); held.current = false; moved.current = false; start.current = { x: event.clientX, y: event.clientY }
      timer.current = setTimeout(() => { held.current = true; onPin(); cancel() }, 450)
    }}
    onPointerMove={event => { if (start.current && Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 8) { moved.current = true; cancel() } }}
    onPointerUp={cancel} onPointerCancel={() => { moved.current = true; cancel() }} onPointerLeave={cancel}
    onContextMenu={event => event.preventDefault()}
    onKeyDown={event => { if (event.shiftKey && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onPin() } }}
    onClick={event => { if (held.current || moved.current) { held.current = false; moved.current = false; return } if (event.shiftKey) onPin(); else onSelect() }}>
    <span className={styles.hotTagName}>{tag.name}</span><span className={styles.tagSuffix} data-pinned={pinned} aria-hidden="true"><span>{tag.postCount}</span><span>×</span></span>
  </button>
}
export function TagFilter({ catalog, selectedTags, current, pinned, onChange }: Props) {
  const active = [...new Set([...pinned, ...(current ? [current] : [])])]
  const extras = active.filter(slug => !catalog.some(tag => tag.slug === slug)).map(slug => ({ id: slug, slug, name: selectedTags.find(tag => tag.slug === slug)?.name ?? slug, postCount: 0 }))
  if (!catalog.length && !active.length) return null
  function remove(slug: string) { onChange(current === slug ? '' : current, pinned.filter(tag => tag !== slug)) }
  return <nav className={`${shell.categories} ${styles.hotTags}`} aria-label="Lọc theo nhãn">
    <button type="button" aria-pressed={!active.length} onClick={() => onChange('', [])}>Tất cả nhãn</button>
    {[...extras, ...catalog].map(tag => <TagButton key={tag.slug} tag={tag} selected={active.includes(tag.slug)} pinned={pinned.includes(tag.slug)} onSelect={() => {
      if (active.includes(tag.slug)) remove(tag.slug)
      else onChange(tag.slug, pinned)
    }} onPin={() => {
      if (pinned.includes(tag.slug)) remove(tag.slug)
      else if (pinned.length < 10) onChange(current === tag.slug ? '' : current, [...pinned, tag.slug])
    }} />)}
  </nav>
}

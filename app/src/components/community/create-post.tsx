'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { AutoTextarea } from '@/components/auto-textarea'
import styles from './shell.module.css'

export function CreatePost() {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [createCounts, setCreateCounts] = useState({ title: 0, excerpt: 0 })
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const [type, setType] = useState<'recipe' | 'blog'>('recipe')
  const createDialog = useRef<HTMLDialogElement>(null)
  const createSource = useRef<HTMLButtonElement | null>(null)
  const popupAnimation = useRef<Animation | null>(null)
  const popupGeneration = useRef(0)
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
      scaleX: from.width / to.width,
      scaleY: from.height / to.height,
    }
  }
  function openCreate(source: HTMLButtonElement) {
    if (createDialog.current?.open) return
    popupGeneration.current += 1
    popupAnimation.current?.cancel()
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
      const scaleX = from.scaleX + (1 - from.scaleX) * progress
      const scaleY = from.scaleY + (1 - from.scaleY) * progress
      const jelly = .012 * Math.sin(t * Math.PI * 4) * Math.sin(t * Math.PI) * Math.exp(-2.8 * t)
      return {
        offset: t,
        transform: `translate3d(${from.x * (1 - progress)}px, ${from.y * (1 - progress)}px, 0) scale(${scaleX * (1 + jelly)}, ${scaleY * (1 - jelly)})`,
        opacity: Math.min(1, .25 + progress * 1.8),
      }
    })
    const animation = createDialog.current.animate(frames, { duration: 700, easing: 'linear' })
    popupAnimation.current = animation
    return () => animation.cancel()
  }, [creating])
  async function closeCreate() {
    if (closePending.current || pendingRef.current) return
    closePending.current = true
    const generation = popupGeneration.current
    const computed = createDialog.current ? getComputedStyle(createDialog.current) : null
    const currentFrame = { transform: computed?.transform ?? 'none', opacity: computed?.opacity ?? '1' }
    popupAnimation.current?.cancel()
    setClosingCreate(true)
    const to = popupFrames()
    if (to && createDialog.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const animation = createDialog.current.animate([
        currentFrame,
        { transform: `translate3d(${to.x}px, ${to.y}px, 0) scale(${to.scaleX}, ${to.scaleY})`, opacity: 0 },
      ], { duration: 300, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' })
      popupAnimation.current = animation
      try { await animation.finished } catch { return }
    }
    if (generation !== popupGeneration.current) return
    createDialog.current?.close()
    popupAnimation.current?.cancel()
    closePending.current = false
    setClosingCreate(false)
  }

  useEffect(() => () => { popupAnimation.current?.cancel() }, [])
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pendingRef.current) return
    const form = new FormData(event.currentTarget)
    pendingRef.current = true; setPending(true); setNotice('')
    try {
      const response = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, title: form.get('title'), excerpt: form.get('description') }) })
      const data = await response.json()
      if (!response.ok) throw new Error(response.status === 401 ? 'Hãy đăng nhập lại để tạo bài.' : 'Không thể tạo bản nháp. Kiểm tra thông tin và thử lại.')
      pendingRef.current = false
      await closeCreate()
      router.push(`/editor/${data.post.id}`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không kết nối được máy chủ.') }
    finally { pendingRef.current = false; setPending(false) }
  }
  return <>
    <button className={styles.createButton} aria-label="Chia sẻ món ngon" onClick={event => openCreate(event.currentTarget)}><span>Chia sẻ món ngon</span><Plus size={18} /></button>
    <dialog ref={createDialog} className={styles.dialog} data-closing={closingCreate} onCancel={event => { event.preventDefault(); void closeCreate() }} onClose={() => { if (!createDialog.current?.open) setCreating(false) }}>
      <button className={styles.closeDialog} disabled={pending} aria-label="Đóng tạo bài" onClick={() => void closeCreate()}><X /></button>
      {creating && <form className={styles.draftForm} onSubmit={submit} aria-busy={pending}>
        <p>GÓC BẾP CỦA BẠN</p><h2>Chia sẻ một món ngon</h2>
        <div className={styles.draftType} data-type={type} role="group" aria-label="Loại bài"><span className={styles.draftTypeMarker} aria-hidden="true" /><button type="button" disabled={pending} aria-pressed={type === 'recipe'} onClick={() => setType('recipe')}>Công thức</button><button type="button" disabled={pending} aria-pressed={type === 'blog'} onClick={() => setType('blog')}>Chuyện trong bếp</button></div>
        <label>Tiêu đề<input name="title" required maxLength={200} disabled={pending} onChange={event => setCreateCounts(current => ({ ...current, title: event.target.value.length }))} placeholder="Ví dụ: Bánh mì trứng nhà làm" /><small className={styles.charCount}>{createCounts.title}/200</small></label>
        <label>Mô tả ngắn<AutoTextarea name="description" required maxLength={500} disabled={pending} rows={4} onChange={event => setCreateCounts(current => ({ ...current, excerpt: event.target.value.length }))} placeholder="Kể một chút về câu chuyện của bạn…" /><small className={styles.charCount}>{createCounts.excerpt}/500</small></label>
        {notice && <p role="alert">{notice}</p>}
        <button type="submit" disabled={pending} className={styles.createButton}>{pending ? 'Đang tạo…' : 'Tạo và mở editor'}</button>
      </form>}
    </dialog>
  </>
}

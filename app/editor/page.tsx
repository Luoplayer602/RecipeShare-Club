'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FadeImage } from '@/components/fade-image'
import { useSortableBlocks } from '@/components/use-sortable-blocks'
import { HeadingLevelSelect } from '@/components/heading-level-select'
import { NumberStepper } from '@/components/number-stepper'
import { IngredientRow } from '@/components/ingredient-row'
import { EditorTag } from '@/components/editor-tag'
import { EditorCollapse } from '@/components/editor-collapse'
import { AutoTextarea } from '@/components/auto-textarea'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowDown, ArrowLeft, ArrowUp, BookOpen, Check, ChefHat, ChevronRight,
  Bookmark, Share2, Clock3, Eye, FileText, GripVertical, ImagePlus, ListChecks,
  Plus, Save, Send, Tag, Trash2, Type, Upload, Users, Video, X,
} from 'lucide-react'
import { FoodArt } from '@/components/food-art'
import { AuthToast } from '@/components/auth-toast'
import styles from './page.module.css'

type Ingredient = { id: string; name: string; quantity: string; unit: string; note: string }
type Block = {
  id: string
  type: 'heading' | 'paragraph' | 'image' | 'video'
  text: string
  src: string
  caption: string
  alt: string
  level: number
  mode: 'upload' | 'url'
}
type Draft = {
  type: 'recipe' | 'blog'
  title: string
  excerpt: string
  cover: string
  prep: string
  cook: string
  servings: string
  difficulty: number
  tags: string[]
  ingredients: Ingredient[]
  blocks: Block[]
}
const STORAGE_KEY = 'recipeshare-editor-draft-v1'
const initialDraft: Draft = {
  type: 'recipe', title: 'Bánh mì trứng, một buổi sáng thật ngon',
  excerpt: 'Một công thức nhỏ cho những buổi sáng bận rộn. Bánh mì giòn, trứng béo thơm và một chút rau tươi.',
  cover: '', prep: '10', cook: '5', servings: '2', difficulty: 1,
  tags: ['Bữa sáng', 'Món trứng'],
  ingredients: [
    { id: 'ingredient-1', name: 'Bánh mì', quantity: '2', unit: 'ổ', note: 'Chọn bánh mới, vỏ giòn' },
    { id: 'ingredient-2', name: 'Trứng gà', quantity: '2', unit: 'quả', note: '' },
    { id: 'ingredient-3', name: 'Dưa leo', quantity: '1/2', unit: 'quả', note: 'Thái lát mỏng' },
  ],
  blocks: [
    { id: 'block-1', type: 'heading', text: 'Một chút chuẩn bị trước khi vào bếp', src: '', caption: '', alt: '', level: 2, mode: 'upload' },
    { id: 'block-2', type: 'paragraph', text: 'Làm nóng bánh mì để lớp vỏ giòn nhẹ. Rửa sạch dưa leo và rau thơm, để ráo rồi thái vừa ăn. Đập trứng ra bát, thêm một chút muối và đánh đều.', src: '', caption: '', alt: '', level: 2, mode: 'upload' },
    { id: 'block-3', type: 'image', text: '', src: '', caption: 'Một chút màu xanh cho bữa sáng.', alt: '', level: 2, mode: 'upload' },
  ],
}
const blockLabels = { heading: 'Tiêu đề', paragraph: 'Đoạn văn', image: 'Hình ảnh', video: 'Video' }
const blockIcons = { heading: Type, paragraph: FileText, image: ImagePlus, video: Video }

function validDraft(value: unknown): value is Draft {
  if (!value || typeof value !== 'object') return false
  const d = value as Draft
  return (d.type === 'recipe' || d.type === 'blog') &&
    ['title', 'excerpt', 'cover', 'prep', 'cook', 'servings'].every(key => typeof (d as unknown as Record<string, unknown>)[key] === 'string') &&
    Number.isInteger(d.difficulty) && d.difficulty >= 1 && d.difficulty <= 5 &&
    Array.isArray(d.tags) && d.tags.length <= 20 && d.tags.every(tag => typeof tag === 'string') &&
    Array.isArray(d.ingredients) && d.ingredients.length <= 200 && d.ingredients.every(row =>
      row && ['id', 'name', 'quantity', 'unit', 'note'].every(key => typeof row[key as keyof Ingredient] === 'string')) &&
    Array.isArray(d.blocks) && d.blocks.length <= 300 && d.blocks.every(block =>
      block && Object.hasOwn(blockLabels, block.type) &&
      ['id', 'text', 'src', 'caption', 'alt'].every(key => typeof block[key as 'id'] === 'string') &&
      [1, 2, 3].includes(block.level) && ['upload', 'url'].includes(block.mode))
}

function videoSource(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return null
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname)) {
      const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) :
        url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:shorts|embed)\/([^/]+)$/)?.[1]
      return id && /^[\w-]{11}$/.test(id) ? { youtube: true, src: 'https://www.youtube-nocookie.com/embed/' + id } : null
    }
    return /\.(mp4|webm)$/i.test(url.pathname) ? { youtube: false, src: url.href } : null
  } catch { return null }
}

function PublishPanel({ draft, onPublish }: { draft: Draft; onPublish: () => void }) {
  const checks = [
    { complete: Boolean(draft.title.trim()), label: 'Một tiêu đề thật hấp dẫn' },
    { complete: Boolean(draft.cover), label: 'Ảnh đại diện món ăn' },
    { complete: draft.blocks.some(block => block.type === 'paragraph' ? Boolean(block.text.trim()) : (block.type === 'image' || block.type === 'video') && Boolean(block.src)), label: 'Nội dung câu chuyện' },
  ]
  return <><div className={styles.checklist}><span className={styles.navCaption}>TRƯỚC KHI CHIA SẺ</span>{checks.map(check => <div key={check.label}><span className={check.complete ? styles.complete : ''}><Check size={12} /></span>{check.label}</div>)}</div><button className={styles.publish} onClick={onPublish}>Sẵn sàng chia sẻ <Send size={16} /></button><p className={styles.demoNote}>Bản thử giao diện · Chưa kết nối máy chủ.<br />Nháp văn bản được lưu trên trình duyệt.</p></>
}

function RecipeFacts({ draft }: { draft: Draft }) {
  return <div className={styles.previewMeta}><span><Clock3 size={14} />Chuẩn bị: {draft.prep || '—'} phút</span><span><Clock3 size={14} />Chế biến: {draft.cook || '—'} phút</span><span><Users size={14} />{draft.servings || '—'} người</span><span><ChefHat size={14} />Độ khó: {draft.difficulty}/5</span></div>
}

function Preview({ draft, compact = false }: { draft: Draft; compact?: boolean }) {
  return <article className={compact ? styles.compactPreview : styles.previewArticle}>
    {!compact && <header className={styles.readerIntro}>
      <Link className={styles.readerBack} href="/home"><ArrowLeft size={13} />Trở về căn bếp</Link>
      <div className={styles.readerTopline}><div className={styles.tags}>{draft.tags.map(tag => <span key={tag}>{tag}</span>)}</div><EditorCollapse open={draft.type === 'recipe'}><RecipeFacts draft={draft} /></EditorCollapse></div>
      <h1>{draft.title || 'Tên bài viết của bạn'}</h1>
      <p>{draft.excerpt || 'Một vài dòng giới thiệu câu chuyện của bạn…'}</p>
      <div className={styles.readerByline}><span className={styles.avatar}>A</span><div><strong>Minh An</strong><small>Chia sẻ từ căn bếp của mình</small></div><span className={styles.readerDate}>Bản nháp · Chưa xuất bản</span></div>
      <div className={styles.readerActions}><span><Eye size={15} />Chưa có lượt xem</span><button type="button" disabled title="Khả dụng sau khi xuất bản"><Bookmark size={15} />Lưu công thức</button><button type="button" disabled title="Khả dụng sau khi xuất bản"><Share2 size={15} />Chia sẻ</button></div>
    </header>}
    <div className={styles.previewCover}>{draft.cover ? <FadeImage src={draft.cover} alt="Ảnh đại diện món ăn" /> : <FoodArt kind={1} />}</div>
    <div className={styles.previewContent}>
      {compact && <><span className={styles.eyebrow}>{draft.type === 'recipe' ? 'TỪ CĂN BẾP CỦA MINH AN' : 'CHUYỆN TRONG BẾP'}</span>
      <h2>{draft.title || 'Tên bài viết của bạn'}</h2>
      <p>{draft.excerpt || 'Một vài dòng giới thiệu câu chuyện của bạn…'}</p></>}
      {compact && <><EditorCollapse open={draft.type === 'recipe'}><RecipeFacts draft={draft} /></EditorCollapse><div className={styles.tags}>{draft.tags.map(tag => <span key={tag}>#{tag}</span>)}</div></>}
      {!compact && <>
        <EditorCollapse open={draft.type === 'recipe'}><section className={styles.previewIngredients}><h3><span className={styles.ingredientNumber}>01</span>Chuẩn bị nguyên liệu</h3>{draft.ingredients.map(row => <div key={row.id}><span>{row.name || 'Nguyên liệu'}{row.note && <small>{row.note}</small>}</span><strong>{row.quantity} {row.unit}</strong></div>)}</section></EditorCollapse>
        {draft.blocks.map(block => {
          if (block.type === 'heading') {
            const Heading = ('h' + block.level) as 'h1' | 'h2' | 'h3'
            return <Heading key={block.id} id={`preview-${block.id}`}>{block.text}</Heading>
          }
          if (block.type === 'paragraph') return <p key={block.id} className={styles.prose}>{block.text}</p>
          if (block.type === 'image') return block.src ? <figure key={block.id}><FadeImage src={block.src} alt={block.alt} /><figcaption>{block.caption}</figcaption></figure> : null
          const source = block.mode === 'url' ? videoSource(block.src) : { youtube: false, src: block.src }
          return source?.src ? <figure key={block.id}>{source.youtube ?
            <iframe src={source.src} title={block.caption || 'Video hướng dẫn'} allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" /> :
            <video src={source.src} controls preload="metadata" />}<figcaption>{block.caption}</figcaption></figure> : null
        })}
      </>}
    </div>
  </article>
}

export default function EditorPage() {
  const [draft, setDraft] = useState<Draft>(initialDraft)
  const addedBlockScroll = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (addedBlockScroll.current !== null) clearTimeout(addedBlockScroll.current)
  }, [])
  const sortable = useSortableBlocks(draft.blocks.map(block => block.id), ids => {
    const byId = new Map(draft.blocks.map(block => [block.id, block]))
    change({ blocks: ids.map(id => byId.get(id)!).filter(Boolean) })
  })
  const tagList = useRef<HTMLDivElement>(null)
  const tagPositions = useRef(new Map<string, { x: number; y: number }>())
  useLayoutEffect(() => {
    const animations: Animation[] = []
    const next = new Map<string, { x: number; y: number }>()
    Array.from(tagList.current?.children ?? []).forEach((child, index) => {
      const item = child as HTMLElement
      const key = draft.tags[index] ?? '__add_tag__'
      const position = { x: item.offsetLeft, y: item.offsetTop }
      const old = tagPositions.current.get(key)
      next.set(key, position)
      if (old && (old.x !== position.x || old.y !== position.y) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        animations.push(item.animate([
          { transform: `translate(${old.x - position.x}px, ${old.y - position.y}px)` },
          { transform: 'translate(0, 0)' },
        ], { duration: 320, easing: 'cubic-bezier(.25,.8,.25,1)' }))
      }
    })
    tagPositions.current = next
    return () => animations.forEach(animation => animation.cancel())
  }, [draft.tags])
  const typeSwitch = useRef<HTMLDivElement>(null)
  const typeMarker = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const container = typeSwitch.current
    function positionMarker() {
      const selected = container?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
      if (!selected || !typeMarker.current) return
      typeMarker.current.style.width = `${selected.offsetWidth}px`
      typeMarker.current.style.transform = `translateX(${selected.offsetLeft}px)`
    }
    positionMarker()
    const fade = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? typeMarker.current?.animate([
        { opacity: 1 },
        { opacity: .15, offset: .35 },
        { opacity: 1 },
      ], { duration: 460, easing: 'ease-in-out' })
      : undefined
    const observer = new ResizeObserver(positionMarker)
    if (container) observer.observe(container)
    return () => { observer.disconnect(); fade?.cancel() }
  }, [draft.type])
  const [tag, setTag] = useState('')
  const [saved, setSaved] = useState(false)
  const [notice, setNotice] = useState('')
  const editorSurface = useRef<HTMLDivElement>(null)
  const [previewMode, setPreviewMode] = useState(false)
  const [previewMounted, setPreviewMounted] = useState(false)
  function switchPreview(next: boolean) {
    if (next === previewMode) return
    const surface = editorSurface.current?.parentElement
    surface?.querySelectorAll<HTMLVideoElement>('video').forEach(video => video.pause())
    // Embedded players are cross-origin: reload their non-autoplay embed to stop playback.
    surface?.querySelectorAll<HTMLIFrameElement>('iframe').forEach(frame => {
      const source = frame.getAttribute('src')
      if (source) frame.setAttribute('src', source)
    })
    if (addedBlockScroll.current !== null) clearTimeout(addedBlockScroll.current)
    if (next) setPreviewMounted(true)
    else if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPreviewMounted(false)
    setPreviewMode(next)
  }
  const objectUrls = useRef(new Set<string>())

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) { const parsed: unknown = JSON.parse(stored); if (validDraft(parsed)) { setDraft(parsed); setSaved(true) } }
      const creating = sessionStorage.getItem('recipeshare-create')
      if (creating) {
        const data = JSON.parse(creating)
        if (typeof data.title === 'string' && typeof data.excerpt === 'string') {
          setDraft({ ...initialDraft, title: data.title, excerpt: data.excerpt })
          setSaved(false)
        }
        sessionStorage.removeItem('recipeshare-create')
      }
    } catch { setNotice('Không thể khôi phục bản nháp trên thiết bị này.') }
    const urls = objectUrls.current
    return () => { urls.forEach(url => URL.revokeObjectURL(url)) }
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  function scrollWorkspace(id: string) {
    const target = document.getElementById(id)
    const workspace = target?.closest('main')
    if (!target || !workspace) return
    workspace.scrollTo({ top: workspace.scrollTop + target.getBoundingClientRect().top - workspace.getBoundingClientRect().top - 20, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  function change(update: Partial<Draft>) { setDraft(current => ({ ...current, ...update })); setSaved(false) }
  function updateBlock(id: string, update: Partial<Block>) { change({ blocks: draft.blocks.map(block => block.id === id ? { ...block, ...update } : block) }) }
  function addBlock(type: Block['type']) {
    if (draft.blocks.length >= 300) { setNotice('Tối đa 300 khối nội dung.'); return }
    const id = crypto.randomUUID()
    sortable.capture()
    change({ blocks: [...draft.blocks, { id, type, text: '', src: '', caption: '', alt: '', level: 2, mode: 'upload' }] })
    if (addedBlockScroll.current !== null) clearTimeout(addedBlockScroll.current)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Measure after the new card has expanded, then reveal the end of the editor.
    addedBlockScroll.current = setTimeout(() => {
      addedBlockScroll.current = null
      const target = document.getElementById(id)
      const workspace = target?.closest('main')
      if (!target || !workspace) return
      if (target.getBoundingClientRect().bottom > workspace.getBoundingClientRect().bottom - 16) {
        workspace.scrollTo({ top: workspace.scrollHeight, behavior: reduced ? 'instant' : 'smooth' })
      }
    }, reduced ? 0 : 450)
  }
  function moveBlock(index: number, direction: number) {
    const blocks = [...draft.blocks]
    const destination = index + direction
    if (destination < 0 || destination >= blocks.length) return
    sortable.capture()
    ;[blocks[index], blocks[destination]] = [blocks[destination], blocks[index]]
    change({ blocks })
  }
  function selectFile(file: File | undefined, kind: 'image' | 'video', blockId?: string) {
    if (!file) return
    const allowed = kind === 'image' ? ['image/jpeg', 'image/png', 'image/webp'] : ['video/mp4', 'video/webm']
    if (!allowed.includes(file.type)) { setNotice('Định dạng chưa hỗ trợ. Chọn JPEG, PNG, WebP hoặc MP4, WebM.'); return }
    if (file.size > (kind === 'image' ? 5 : 50) * 1024 * 1024) { setNotice(kind === 'image' ? 'Ảnh tối đa 5 MiB.' : 'Video tối đa 50 MiB.'); return }
    const src = URL.createObjectURL(file)
    objectUrls.current.add(src)
    if (blockId) updateBlock(blockId, { src, mode: 'upload' })
    else change({ cover: src })
  }
  function addTag() {
    const value = tag.trim().replace(/^#/, '')
    if (!value) return
    if (value.length > 60 || draft.tags.length >= 20) { setNotice('Tối đa 20 nhãn, mỗi nhãn 60 ký tự.'); return }
    if (!draft.tags.some(item => item.toLocaleLowerCase('vi') === value.toLocaleLowerCase('vi'))) change({ tags: [...draft.tags, value] })
    setTag('')
  }
  function save() {
    try {
      const serializable = { ...draft, cover: '', blocks: draft.blocks.map(block => ({ ...block, src: block.src.startsWith('blob:') ? '' : block.src })) }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable))
      setSaved(true)
      setNotice('Đã lưu nháp trên trình duyệt. File tải lên cần chọn lại sau khi tải lại trang.')
    } catch { setNotice('Không thể lưu nháp. Kiểm tra dung lượng hoặc quyền lưu trữ của trình duyệt.') }
  }
  function previewPublication() {
    const hasContent = draft.blocks.some(block => block.type === 'paragraph' ? block.text.trim() : block.type !== 'heading' && Boolean(block.src))
    if (!draft.title.trim() || !draft.excerpt.trim() || !draft.cover || !hasContent) { setNotice('Thêm tiêu đề, mô tả, ảnh đại diện và nội dung trước khi xuất bản.'); return }
    if (draft.type === 'recipe' && (!draft.ingredients.length || draft.ingredients.some(row => !row.name.trim()) || !draft.prep || !draft.cook || Number(draft.servings) < 1)) { setNotice('Hoàn thiện thông tin công thức và nguyên liệu trước khi xuất bản.'); return }
    switchPreview(true)
    setNotice('Bản xem thử đã sẵn sàng. Demo chưa xuất bản lên máy chủ.')
  }

  return <div className={styles.page}>
    <header className={styles.header}>
      <Link href="/home" className={styles.logo}><Image src="/icons/logo.png" alt="" width={48} height={48} priority unoptimized /><span>RecipeShare<small>CLUB</small></span></Link>
      <div className={styles.breadcrumb}><span>Căn bếp của bạn</span><ChevronRight size={14} /><strong>{previewMode ? 'Xem trước bài viết' : 'Soạn bài viết'}</strong></div>
      <div className={styles.headerActions}><span className={styles.saveState}>{saved ? <Check size={14} /> : <span className={styles.dot} />}{saved ? 'Đã lưu trên thiết bị' : 'Bản nháp'}</span><button className={styles.secondary} aria-label={previewMode ? 'Về editor' : 'Xem trước bài viết'} aria-pressed={previewMode} onClick={() => switchPreview(!previewMode)}>{previewMode ? <FileText size={16} /> : <Eye size={16} />}<span>{previewMode ? 'Về editor' : 'Xem trước'}</span></button><button className={styles.primary} onClick={save}>{saved ? <Check key="saved" size={16} /> : <Save key="unsaved" size={16} />}<span>{saved ? 'Đã lưu nháp' : 'Lưu nháp'}</span></button></div>
    </header>
    <div className={styles.modeBody}>
    <div ref={editorSurface} className={`${styles.layout} ${styles.editorMode}`} data-active={!previewMode} inert={previewMode} aria-hidden={previewMode}>
      <aside className={styles.sidebar}>
        <Link className={styles.back} href="/home"><ArrowLeft size={16} /><span>Về trang chủ</span></Link>
        <div className={styles.author}><span className={styles.avatar}>A</span><div>Minh An<small>Đầu bếp thực tập</small></div></div>
        <span className={styles.navCaption}>TRONG BÀI VIẾT</span>
        <nav><a href="#information" onClick={event => { event.preventDefault(); history.replaceState(null, '', '#information'); scrollWorkspace('information') }}><FileText size={17} /><span>Thông tin chung</span></a><EditorCollapse open={draft.type === 'recipe'}><a href="#ingredients" onClick={event => { event.preventDefault(); history.replaceState(null, '', '#ingredients'); scrollWorkspace('ingredients') }}><ListChecks size={17} /><span>Nguyên liệu</span><small>{draft.ingredients.length}</small></a></EditorCollapse><a href="#content" onClick={event => { event.preventDefault(); history.replaceState(null, '', '#content'); scrollWorkspace('content') }}><BookOpen size={17} /><span>Nội dung</span><small>{draft.blocks.length}</small></a></nav>
        <div className={styles.sidebarBottom}><ChefHat size={29} /><p>Công thức của bạn,<br /><em>cảm hứng của ai đó.</em></p><small>Mỗi điều nhỏ bạn chia sẻ đều có thể làm một căn bếp ấm hơn.</small></div>
      </aside>
      <main className={styles.workspace}>
        <div className={styles.intro}><div><p className={styles.eyebrow}>TỪ CĂN BẾP CỦA BẠN</p><h1>Chia sẻ một chút <em>ngon lành.</em></h1><p>Một công thức, một câu chuyện. Viết theo cách của bạn.</p></div><span className={styles.draftBadge}><span className={styles.dot} />Đang soạn</span></div>
        <section id="information" className={styles.section}>
          <div className={styles.sectionHeading}><span>01</span><h2>Bắt đầu câu chuyện</h2><small>Thông tin chung</small></div>
          <div className={styles.information}>
            <div className={styles.cover}>
              <div className={styles.coverArt}>{draft.cover ? <FadeImage src={draft.cover} alt="Ảnh đại diện đã chọn" /> : <FoodArt kind={1} />}<span className={styles.coverBadge}>ẢNH ĐẠI DIỆN</span></div>
              <label className={styles.coverUpload}><Upload size={15} />{draft.cover ? 'Thay ảnh đại diện' : 'Chọn ảnh cho món ngon'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { selectFile(e.target.files?.[0], 'image'); e.target.value = '' }} /></label>
              <small>JPEG, PNG, WebP · Tối đa 5 MiB</small>
            </div>
            <div className={styles.mainFields}>
              <div ref={typeSwitch} className={styles.typeSwitch} role="group" aria-label="Loại bài viết"><span ref={typeMarker} className={styles.typeMarker} aria-hidden="true" /><button aria-pressed={draft.type === 'recipe'} onClick={() => change({ type: 'recipe' })}><ChefHat size={15} />Công thức</button><button aria-pressed={draft.type === 'blog'} onClick={() => change({ type: 'blog' })}><BookOpen size={15} />Chuyện trong bếp</button></div>
              <label className={styles.field}>Tiêu đề<input value={draft.title} maxLength={200} onChange={e => change({ title: e.target.value })} placeholder="Đặt tên cho câu chuyện của bạn…" /></label>
              <label className={styles.field}>Mô tả ngắn<AutoTextarea value={draft.excerpt} maxRows={4} maxLength={500} rows={3} onChange={e => change({ excerpt: e.target.value })} placeholder="Điều gì làm món ăn này đặc biệt?" /><small>{draft.excerpt.length}/500</small></label>
              <div className={styles.tagLabel}><Tag size={14} />Nhãn bài viết</div>
              <div ref={tagList} className={styles.tags}>{draft.tags.map(item => <EditorTag key={item} name={item} onRemove={() => change({ tags: draft.tags.filter(t => t !== item) })} />)}<form className={styles.addTag} onSubmit={e => { e.preventDefault(); addTag() }}><input aria-label="Nhãn mới" value={tag} onChange={e => setTag(e.target.value)} placeholder="+ Thêm nhãn" maxLength={60} /><button aria-label="Thêm nhãn" type="submit"><Plus size={14} /></button></form></div>
            </div>
          </div>
          <EditorCollapse open={draft.type === 'recipe'}><div className={styles.recipeMeta}>
            <label className={styles.field}><span><Clock3 size={14} />Chuẩn bị</span><div className={styles.numberInput}><NumberStepper label="Số phút chuẩn bị" min={0} max={100000} value={draft.prep} onChange={value => change({ prep: value })} /><span>phút</span></div></label>
            <label className={styles.field}><span><Clock3 size={14} />Chế biến</span><div className={styles.numberInput}><NumberStepper label="Số phút chế biến" min={0} max={100000} value={draft.cook} onChange={value => change({ cook: value })} /><span>phút</span></div></label>
            <label className={styles.field}><span><Users size={14} />Khẩu phần</span><div className={styles.numberInput}><NumberStepper label="Số khẩu phần" min={1} max={100000} value={draft.servings} onChange={value => change({ servings: value })} /><span>người</span></div></label>
            <div className={styles.difficulty}><span>Độ khó <small>{['', 'Dễ làm', 'Vừa sức', 'Cần khéo léo', 'Thử thách', 'Chuyên nghiệp'][draft.difficulty]}</small></span><div role="group" aria-label="Độ khó">{[1, 2, 3, 4, 5].map(value => <button key={value} aria-label={'Độ khó ' + value + ' trên 5'} aria-pressed={draft.difficulty === value} className={value <= draft.difficulty ? styles.selectedHat : ''} onClick={() => change({ difficulty: value })}><ChefHat size={23} /></button>)}</div></div>
          </div></EditorCollapse>
        </section>
        <EditorCollapse open={draft.type === 'recipe'}><section id="ingredients" className={styles.section}>
          <div className={styles.sectionHeading}><span>02</span><h2>Một chút nguyên liệu</h2><small>{draft.ingredients.length} nguyên liệu</small></div>
          <div className={styles.tableScroll}><table className={styles.ingredients}><thead><tr><th>NGUYÊN LIỆU</th><th>ĐỊNH LƯỢNG</th><th>ĐƠN VỊ</th><th>GHI CHÚ</th><th><span className="sr-only">Xóa</span></th></tr></thead><tbody>{draft.ingredients.map((row, index) => <IngredientRow key={row.id} row={row} index={index} onChange={(key, value) => change({ ingredients: draft.ingredients.map(item => item.id === row.id ? { ...item, [key]: value } : item) })} onRemove={() => change({ ingredients: draft.ingredients.filter(item => item.id !== row.id) })} />)}</tbody></table></div>
          <button className={styles.addRow} disabled={draft.ingredients.length >= 200} onClick={() => change({ ingredients: [...draft.ingredients, { id: crypto.randomUUID(), name: '', quantity: '', unit: '', note: '' }] })}><Plus size={15} />Thêm nguyên liệu</button>
        </section></EditorCollapse>
        <section id="content" className={styles.contentSection}>
          <div className={styles.sectionHeading}><span>{draft.type === 'recipe' ? '03' : '02'}</span><h2>Viết theo cách của bạn</h2><small>{draft.blocks.length} khối nội dung</small></div>
          <p className={styles.sectionHint}>Ghép những khối nhỏ thành một câu chuyện trọn vẹn.</p>
          <div ref={sortable.container} className={styles.blockList}>{draft.blocks.map((block, index) => {
            const Icon = blockIcons[block.type]
            const source = block.mode === 'url' ? videoSource(block.src) : { youtube: false, src: block.src }
            return <article id={block.id} data-block-id={block.id} data-block-kind={block.type} className={styles.block} key={block.id}>
              <header className={styles.blockHeader} onPointerDown={event => sortable.start(event, block.id)} title="Kéo phần đầu thẻ để sắp xếp; hoặc dùng mũi tên"><GripVertical size={15} /><span className={styles.codeLabel}>{'<' + block.type + '>'}</span><span className={styles.blockName}><Icon size={14} />{blockLabels[block.type]}</span><div className={styles.blockActions}><button disabled={index === 0} aria-label="Di chuyển khối lên" onClick={() => moveBlock(index, -1)}><ArrowUp size={15} /></button><button disabled={index === draft.blocks.length - 1} aria-label="Di chuyển khối xuống" onClick={() => moveBlock(index, 1)}><ArrowDown size={15} /></button><button aria-label="Xóa khối" onClick={() => { sortable.capture(); change({ blocks: draft.blocks.filter(item => item.id !== block.id) }) }}><Trash2 size={14} /></button></div></header>
              <div className={styles.blockBody}>
                {block.type === 'heading' && <div className={styles.headingEditor}><HeadingLevelSelect value={block.level} onChange={level => updateBlock(block.id, { level })} /><input aria-label="Nội dung tiêu đề" value={block.text} maxLength={200} placeholder="Một tiêu đề mới…" onChange={e => updateBlock(block.id, { text: e.target.value })} /></div>}
                {block.type === 'paragraph' && <AutoTextarea aria-label="Nội dung đoạn văn" className={styles.paragraph} rows={4} value={block.text} maxLength={20000} placeholder="Kể câu chuyện, chia sẻ từng bước thực hiện…" onChange={e => updateBlock(block.id, { text: e.target.value })} />}
                {(block.type === 'image' || block.type === 'video') && <>
                  {block.type === 'video' && <div className={styles.videoModes}><button aria-pressed={block.mode === 'upload'} onClick={() => updateBlock(block.id, { mode: 'upload', src: '' })}><Upload size={14} />Tải video</button><button aria-pressed={block.mode === 'url'} onClick={() => updateBlock(block.id, { mode: 'url', src: '' })}>YouTube / URL</button></div>}
                  {block.type === 'video' && block.mode === 'url' && <label className={styles.field}>Đường dẫn video<input type="url" value={block.src} placeholder="https://www.youtube.com/watch?v=…" onChange={e => updateBlock(block.id, { src: e.target.value })} />{block.src && !source && <small>Nhập URL HTTPS của YouTube hoặc file MP4/WebM.</small>}</label>}
                  {block.src && block.type === 'image' ? <FadeImage className={styles.blockImage} src={block.src} alt={block.alt} /> : block.type === 'video' && source?.src ? source.youtube ? <iframe className={styles.video} title={block.caption || 'Xem thử video'} src={source.src} allowFullScreen /> : <video className={styles.video} src={source.src} controls preload="metadata" /> : null}
                  {(block.type === 'image' || block.mode === 'upload') && <label className={block.src ? styles.replaceFile : styles.dropzone}><Upload size={block.src ? 15 : 25} /><strong>{block.src ? 'Chọn file khác' : block.type === 'image' ? 'Thêm một hình ảnh vào câu chuyện' : 'Chọn video hướng dẫn của bạn'}</strong>{!block.src && <small>{block.type === 'image' ? 'JPEG, PNG, WebP · Tối đa 5 MiB' : 'MP4, WebM · Tối đa 50 MiB'}</small>}<input type="file" accept={block.type === 'image' ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/webm'} onChange={e => { selectFile(e.target.files?.[0], block.type as 'image' | 'video', block.id); e.target.value = '' }} /></label>}
                  <input data-drag-video-extra className={styles.captionInput} aria-label="Chú thích media" placeholder="Thêm chú thích (không bắt buộc)" value={block.caption} maxLength={500} onChange={e => updateBlock(block.id, { caption: e.target.value })} />
                  {block.type === 'image' && <details className={styles.settings}><summary>Mô tả ảnh cho người đọc màn hình</summary><input aria-label="Văn bản thay thế ảnh" placeholder="Mô tả ngắn nội dung trong ảnh…" value={block.alt} maxLength={255} onChange={e => updateBlock(block.id, { alt: e.target.value })} /></details>}
                </>}
              </div>
            </article>
          })}</div>
          <div className={styles.addBlock}><span>THÊM VÀO CÂU CHUYỆN</span><div>{(['heading', 'paragraph', 'image', 'video'] as const).map(type => { const Icon = blockIcons[type]; return <button key={type} onClick={() => addBlock(type)}><Icon size={17} />{blockLabels[type]}<Plus size={13} /></button> })}</div></div>
        </section>
        <footer className={styles.editorFooter}><Link href="/home"><ArrowLeft size={15} />Trở về căn bếp</Link><div className={styles.footerActions}><button className={styles.primary} onClick={save}>{saved ? <Check key="saved" size={16} /> : <Save key="unsaved" size={16} />}{saved ? 'Đã lưu nháp' : 'Lưu bản nháp'}</button><button className={styles.mobilePublish} onClick={previewPublication}><Send size={16} />Chia sẻ</button></div></footer>
      </main>
      <aside className={styles.previewPanel}>
        <div className={styles.previewPanelHeader}><span><Eye size={16} />Bài viết của bạn</span><span className={styles.liveBadge}><span />Xem trực tiếp</span></div>
        <Preview draft={draft} compact />
        <button className={styles.fullPreview} onClick={() => switchPreview(true)}>Mở bản xem trước <ChevronRight size={15} /></button>
        <PublishPanel draft={draft} onPublish={previewPublication} />
      </aside>
    </div>
    {previewMounted && <div className={styles.readingMode} data-active={previewMode} inert={!previewMode} aria-hidden={!previewMode} onTransitionEnd={event => {
      if (!previewMode && event.target === event.currentTarget && event.propertyName === 'opacity') setPreviewMounted(false)
    }}>
      <aside className={styles.readingNav}><span className={styles.navCaption}>TRONG BÀI VIẾT</span><button className={styles.secondary} onClick={() => switchPreview(false)}><ArrowLeft size={15} />Tiếp tục chỉnh sửa</button>{draft.blocks.filter(block => block.type === 'heading').map(block => <a key={block.id} href={`#preview-${block.id}`} onClick={event => { event.preventDefault(); scrollWorkspace(`preview-${block.id}`) }}>{block.text || 'Tiêu đề chưa đặt'}</a>)}</aside>
      <main className={styles.readingFeed}><div className={styles.readingNotice}><Eye size={15} /><span>Bản xem trước · Nội dung chưa xuất bản</span></div><Preview draft={draft} /></main>
      <aside className={styles.readingAside}><PublishPanel draft={draft} onPublish={previewPublication} /></aside>
    </div>}
    </div>
    <AuthToast message={notice} />
  </div>
}

'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { groupImages } from '@/lib/posts/image-groups'
import { ImageGroup } from '@/components/image-group'
import { VideoPlayer } from '@/components/video-player'
import { pauseAllPlayback } from '@/lib/media/playback'
import { FadeImage } from '@/components/fade-image'
import { useSortableBlocks } from '@/components/use-sortable-blocks'
import { ListContent, listItems, type ListStyle } from '@/components/list-content'
import { ListStyleSelect } from '@/components/list-style-select'
import { HeadingLevelSelect } from '@/components/heading-level-select'
import { NumberStepper } from '@/components/number-stepper'
import { IngredientRow } from '@/components/ingredient-row'
import { EditorTag } from '@/components/editor-tag'
import { EditorCollapse } from '@/components/editor-collapse'
import { ImageAltField } from '@/components/image-alt-field'
import { AutoTextarea } from '@/components/auto-textarea'
import { ChefLoader } from '@/components/chef-loader'
import { useRouter } from 'next/navigation'
import type { SessionUser, PostDetail } from '@/components/community/types'
import { saveEditorSchema, type SaveEditorInput } from '@/lib/posts/editor-validation'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowDown, ArrowLeft, ArrowUp, BookOpen, Check, ChefHat, ChevronRight,
  Bookmark, Share2, Clock3, Eye, FileText, GripVertical, ImagePlus, ListChecks,
  Plus, Save, Send, Tag, Trash2, Type, Upload, Users, Video, X,
} from 'lucide-react'
import { FoodArt } from '@/components/food-art'
import { UnsavedChanges } from '@/components/unsaved-changes'
import { AuthToast } from '@/components/auth-toast'
import styles from './page.module.css'

type Ingredient = { id: string; name: string; quantity: string; unit: string; note: string }
type Block = {
  id: string
  type: 'heading' | 'paragraph' | 'image' | 'video' | 'list'
  text: string
  src: string
  caption: string
  alt: string
  level: number
  listStyle: ListStyle
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
const initialDraft: Draft = {
  type: 'recipe', title: '', excerpt: '', cover: '', prep: '', cook: '', servings: '',
  difficulty: 1, tags: [], ingredients: [], blocks: [],
}
function localId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}
async function apiRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const data = await response.json()
  if (!response.ok) {
    if (response.status === 401) throw new Error('Phiên đăng nhập đã hết. Hãy đăng nhập lại trước khi tiếp tục.')
    if (response.status === 404) throw new Error('Không tìm thấy bản nháp hoặc bạn không có quyền mở bài này.')
    if (data.code === 'POST_NOT_DRAFT') throw new Error('Bài đã xuất bản, hiện không thể lưu lại dưới dạng nháp.')
    throw new Error(data.message || 'Không thể hoàn tất. Kiểm tra thông tin và thử lại.')
  }
  return data
}
const blockLabels = { heading: 'Tiêu đề', paragraph: 'Đoạn văn', image: 'Hình ảnh', video: 'Video', list: 'Danh sách' }
const blockIcons = { heading: Type, paragraph: FileText, image: ImagePlus, video: Video, list: ListChecks }

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

function hasBlockContent(block: Block) {
  if (block.type === 'heading') return false
  if (block.type === 'paragraph' || block.type === 'list') return Boolean(block.text.trim())
  return Boolean(block.src)
}

function PublishPanel({ draft, onPublish, published=false }: { draft: Draft; onPublish: () => void; published?:boolean }) {
  const checks = [
    { complete: Boolean(draft.title.trim()), label: 'Một tiêu đề thật hấp dẫn' },
    { complete: Boolean(draft.cover), label: 'Ảnh đại diện món ăn' },
    { complete: draft.blocks.some(hasBlockContent), label: 'Nội dung câu chuyện' },
  ]
  return <><div className={styles.checklist}><span className={styles.navCaption}>TRƯỚC KHI CHIA SẺ</span>{checks.map(check => <div key={check.label}><span className={check.complete ? styles.complete : ''}><Check size={12} /></span>{check.label}</div>)}</div><button className={styles.publish} onClick={onPublish}>{published?'Cập nhật bài viết':'Sẵn sàng chia sẻ'} <Send size={16} /></button><p className={styles.demoNote}>Bản nháp được lưu trên máy chủ khi bạn nhấn lưu.<br />Chỉ xuất bản khi bạn đã sẵn sàng.</p></>
}

function RecipeFacts({ draft }: { draft: Draft }) {
  return <div className={styles.previewMeta}><span><Clock3 size={14} />Chuẩn bị: {draft.prep || '—'} phút</span><span><Clock3 size={14} />Chế biến: {draft.cook || '—'} phút</span><span><Users size={14} />{draft.servings || '—'} người</span><span><ChefHat size={14} />Độ khó: {draft.difficulty}/5</span></div>
}

function Preview({ draft, user, compact = false }: { draft: Draft; user: SessionUser; compact?: boolean }) {
  return <article className={compact ? styles.compactPreview : styles.previewArticle}>
    {!compact && <header className={styles.readerIntro}>
      <Link className={styles.readerBack} href="/home"><ArrowLeft size={13} />Trở về căn bếp</Link>
      <div className={styles.readerTopline}><div className={styles.tags}>{draft.tags.map(tag => <span key={tag}>{tag}</span>)}</div><EditorCollapse open={draft.type === 'recipe'}><RecipeFacts draft={draft} /></EditorCollapse></div>
      <h1>{draft.title || 'Tên bài viết của bạn'}</h1>
      <p>{draft.excerpt || 'Một vài dòng giới thiệu câu chuyện của bạn…'}</p>
      <div className={styles.readerByline}><span className={styles.avatar}>{user.displayName.slice(0, 1)}</span><div><strong>{user.displayName}</strong><small>{user.titleName}</small></div><span className={styles.readerDate}>Bản nháp · Chưa xuất bản</span></div>
      <div className={styles.readerActions}><span><Eye size={15} />Chưa có lượt xem</span><button type="button" disabled title="Khả dụng sau khi xuất bản"><Bookmark size={15} />Lưu công thức</button><button type="button" disabled title="Khả dụng sau khi xuất bản"><Share2 size={15} />Chia sẻ</button></div>
    </header>}
    <div className={styles.previewCover}>{draft.cover ? <FadeImage src={draft.cover} alt="Ảnh đại diện món ăn" /> : <FoodArt kind={1} />}</div>
    <div className={styles.previewContent}>
      {compact && <><span className={styles.eyebrow}>{draft.type === 'recipe' ? `TỪ CĂN BẾP CỦA ${user.displayName.toLocaleUpperCase('vi')}` : 'CHUYỆN TRONG BẾP'}</span>
      <h2>{draft.title || 'Tên bài viết của bạn'}</h2>
      <p>{draft.excerpt || 'Một vài dòng giới thiệu câu chuyện của bạn…'}</p></>}
      {compact && <><EditorCollapse open={draft.type === 'recipe'}><RecipeFacts draft={draft} /></EditorCollapse><div className={styles.tags}>{draft.tags.map(tag => <span key={tag}>#{tag}</span>)}</div></>}
      {!compact && <>
        <EditorCollapse open={draft.type === 'recipe'}><section className={styles.previewIngredients}><h3><span className={styles.ingredientNumber}>01</span>Chuẩn bị nguyên liệu</h3>{draft.ingredients.map(row => <div key={row.id}><span>{row.name || 'Nguyên liệu'}{row.note && <small>{row.note}</small>}</span><strong>{row.quantity} {row.unit}</strong></div>)}</section></EditorCollapse>
        {groupImages(draft.blocks, block => block.type === 'image' && Boolean(block.src)).map(group => {
          if (group.kind === 'images') return <ImageGroup key={group.items[0].id} images={group.items.map(block => ({ id: block.id, src: block.src, alt: block.alt, caption: block.caption }))} />
          const block = group.block
          if (block.type === 'heading') {
            const Heading = ('h' + block.level) as 'h1' | 'h2' | 'h3'
            return <Heading key={block.id} id={`preview-${block.id}`}>{block.text}</Heading>
          }
          if (block.type === 'list') return <ListContent key={block.id} data={{ type: 'list', style: block.listStyle, items: listItems(block.text) }} />
          if (block.type === 'paragraph') return <p key={block.id} className={styles.prose}>{block.text}</p>
          if (block.type === 'image') return block.src ? <figure key={block.id}><FadeImage src={block.src} alt={block.alt} /><figcaption>{block.caption}</figcaption></figure> : null
          const source = block.mode === 'url' ? videoSource(block.src) : { youtube: false, src: block.src }
          return source?.src ? <figure key={block.id}><VideoPlayer src={source.src} youtube={source.youtube} title={block.caption || 'Video hướng dẫn'} /><figcaption>{block.caption}</figcaption></figure> : null
        })}
      </>}
    </div>
  </article>
}

export default function EditorPage({ postId, user }: { postId: string; user: SessionUser }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [published,setPublished]=useState(false),[noticeHidden,setNoticeHidden]=useState(false)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [working, setWorking] = useState(false)
  const operation = useRef(false)
  const revision = useRef(0)
  const mediaIds = useRef(new Map<string, string>())
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
  }, [draft.type, loading])
  const [tag, setTag] = useState('')
  const [saved, setSaved] = useState(false)
  const [notice, setNotice] = useState('')
  const editorSurface = useRef<HTMLDivElement>(null)
  const [previewMode, setPreviewMode] = useState(false)
  const [previewMounted, setPreviewMounted] = useState(false)
  function switchPreview(next: boolean) {
    if (next === previewMode) return
    pauseAllPlayback()
    if (addedBlockScroll.current !== null) clearTimeout(addedBlockScroll.current)
    if (next) setPreviewMounted(true)
    else if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPreviewMounted(false)
    setPreviewMode(next)
  }
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true); setLoadError('')
      try {
        const { post } = await apiRequest(`/api/posts/${postId}/edit`, { signal: controller.signal }) as {
          post: Omit<PostDetail, 'blocks'> & { status: string; blocks: (PostDetail['blocks'][number] & { id: string })[] }
        }
        if (controller.signal.aborted) return
        if (!['draft','published'].includes(post.status)) { router.replace(`/posts/${postId}`); return }
        setPublished(post.status==='published')
        const sources = new Map(post.media.map(media => {
          const src = media.source === 'upload' ? `/api/media/${media.id}/file` : media.url || ''
          mediaIds.current.set(src, media.id)
          return [media.id, { src, mode: media.source === 'url' ? 'url' as const : 'upload' as const }]
        }))
        setDraft({ ...initialDraft, type: post.type, title: post.title, excerpt: post.excerpt,
          cover: post.coverMediaId ? sources.get(post.coverMediaId)?.src || '' : '',
          prep: String(post.recipe?.prepMinutes ?? ''), cook: String(post.recipe?.cookMinutes ?? ''),
          servings: String(post.recipe?.servings ?? ''), difficulty: post.recipe?.difficulty ?? 1,
          tags: post.tags.map(tag => tag.name),
          ingredients: post.recipe?.ingredients.map(row => ({ id: localId(), name: row.name, quantity: row.quantity || '', unit: row.unit || '', note: row.note || '' })) || [],
          blocks: post.blocks.map(({ id, data }) => ({ id, type: data.type,
            text: data.type === 'list' ? data.items.join('\n') : 'text' in data ? data.text : '',
            listStyle: data.type === 'list' ? data.style : 'disc', level: data.type === 'heading' ? data.level : 2,
            src: 'mediaId' in data ? sources.get(data.mediaId)?.src || '' : '',
            mode: 'mediaId' in data ? sources.get(data.mediaId)?.mode || 'upload' : 'upload',
            alt: data.type === 'image' ? data.alt : '', caption: 'caption' in data ? data.caption || '' : '',
          })),
        })
        setSaved(true)
      } catch (error) { if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Không tải được bản nháp.') }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [postId, retry, router])

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

  function change(update: Partial<Draft>) { revision.current++; setDraft(current => ({ ...current, ...update })); setSaved(false) }
  function updateBlock(id: string, update: Partial<Block>) { revision.current++; setDraft(current => ({ ...current, blocks: current.blocks.map(block => block.id === id ? { ...block, ...update } : block) })); setSaved(false) }
  function addBlock(type: Block['type']) {
    if (draft.blocks.length >= 300) { setNotice('Tối đa 300 khối nội dung.'); return }
    const id = localId()
    sortable.capture()
    change({ blocks: [...draft.blocks, { id, type, text: '', src: '', caption: '', alt: '', level: 2, listStyle: 'disc', mode: 'upload' }] })
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
  async function selectFile(file: File | undefined, kind: 'image' | 'video', blockId?: string) {
    if (!file) return
    const allowed = kind === 'image' ? ['image/jpeg', 'image/png', 'image/webp'] : ['video/mp4', 'video/webm']
    if (!allowed.includes(file.type)) { setNotice('Định dạng chưa hỗ trợ. Chọn JPEG, PNG, WebP hoặc MP4, WebM.'); return }
    if (file.size > (kind === 'image' ? 5 : 50) * 1024 * 1024) { setNotice(kind === 'image' ? 'Ảnh tối đa 5 MiB.' : 'Video tối đa 50 MiB.'); return }
    if (operation.current) return
    operation.current = true; setWorking(true); setNotice('Đang tải tệp lên…')
    try {
      const body = new FormData(); body.set('file', file)
      const { media } = await apiRequest('/api/media/upload', { method: 'POST', body })
      const src = `/api/media/${media.id}/file`
      mediaIds.current.set(src, media.id)
      if (blockId) updateBlock(blockId, { src, mode: 'upload' })
      else change({ cover: src })
      setNotice('Đã tải tệp lên. Nhấn lưu nháp để lưu vào bài viết.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không tải được tệp.') }
    finally { operation.current = false; setWorking(false) }
  }

  function addTag() {
    const value = tag.trim().replace(/^#/, '')
    if (!value) return
    if (value.length > 60 || draft.tags.length >= 20) { setNotice('Tối đa 20 danh mục, mỗi danh mục 60 ký tự.'); return }
    if (!draft.tags.some(item => item.toLocaleLowerCase('vi') === value.toLocaleLowerCase('vi'))) change({ tags: [...draft.tags, value] })
    setTag('')
  }
  async function persist(snapshot: Draft) {
    const blocks: SaveEditorInput['blocks'] = []
    for (const block of snapshot.blocks) {
      if (block.type === 'heading') { blocks.push({ type: 'heading', level: block.level as 1 | 2 | 3, text: block.text }); continue }
      if (block.type === 'paragraph') { blocks.push({ type: 'paragraph', text: block.text }); continue }
      if (block.type === 'list') {
        const items = listItems(block.text)
        if (items.length > 100 || items.some(item => item.length > 500)) throw new Error('Danh sách tối đa 100 mục, mỗi mục tối đa 500 ký tự.')
        blocks.push({ type: 'list', style: block.listStyle, items })
        continue
      }
      if (!block.src.trim()) throw new Error('Chọn tệp hoặc điền đường dẫn cho thẻ ảnh/video; hoặc xóa thẻ trống trước khi lưu.')
      let mediaId = mediaIds.current.get(block.src)
      if (!mediaId && block.type === 'video' && block.mode === 'url') {
        const { media } = await apiRequest('/api/media/video-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: block.src }) })
        mediaId = media.id
        mediaIds.current.set(block.src, media.id)
      }
      if (!mediaId) throw new Error('Tệp chưa tải lên thành công. Vui lòng chọn lại.')
      blocks.push(block.type === 'image' ? { type: 'image', mediaId, alt: block.alt, caption: block.caption } : { type: 'video', mediaId, caption: block.caption })
    }
    const number = (value: string) => value.trim() ? Number(value) : null
    const payload = saveEditorSchema.safeParse({ title: snapshot.title, excerpt: snapshot.excerpt,
      coverMediaId: snapshot.cover ? mediaIds.current.get(snapshot.cover) : null,
      recipe: snapshot.type === 'recipe' ? { prepMinutes: number(snapshot.prep), cookMinutes: number(snapshot.cook), servings: number(snapshot.servings), difficulty: snapshot.difficulty,
        ingredients: snapshot.ingredients.map(row => ({ name: row.name, quantity: row.quantity || null, unit: row.unit || null, note: row.note || null })) } : null,
      blocks, tagNames: snapshot.tags,
    })
    if (!payload.success) throw new Error('Kiểm tra tiêu đề, nguyên liệu và các giá trị số trước khi lưu.')
    await apiRequest(`/api/posts/${postId}/edit`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload.data) })
  }
  async function save():Promise<boolean> {
    if (operation.current) return false
    operation.current = true; setWorking(true)
    const version = revision.current
    try {
      await persist(draft)
      if (revision.current === version) setSaved(true)
      setNotice(revision.current === version ? (published?'Đã lưu bản sửa. Bản đang xuất bản chưa thay đổi.':'Đã lưu bản nháp trên máy chủ.') : 'Đã lưu phiên bản trước. Bạn có thay đổi mới cần lưu thêm.')
      return revision.current===version
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không lưu được bản nháp.');return false }
    finally { operation.current = false; setWorking(false) }
  }
  async function previewPublication() {
    if (operation.current) return
    const hasContent = draft.blocks.some(hasBlockContent)
    if (!draft.title.trim() || !draft.excerpt.trim() || !draft.cover || !hasContent) { setNotice('Thêm tiêu đề, mô tả, ảnh đại diện và nội dung trước khi xuất bản.'); return }
    if (draft.type === 'recipe' && (!draft.ingredients.length || draft.ingredients.some(row => !row.name.trim()) || !draft.prep || !draft.cook || Number(draft.servings) < 1)) { setNotice('Hoàn thiện thông tin công thức và nguyên liệu trước khi xuất bản.'); return }
    operation.current = true; setWorking(true)
    try {
      await persist(draft)
      await apiRequest(`/api/posts/${postId}/publish`, { method: 'POST' })
      setSaved(true)
      router.replace(`/posts/${postId}`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Không xuất bản được bài viết.') }
    finally { operation.current = false; setWorking(false) }
  }
  if (loading) return <main className={styles.page} aria-busy="true"><ChefLoader label="Đang tải bản nháp" /></main>
  if (loadError) return <main style={{ padding: 32 }}><Link href="/home">← Về trang chủ</Link><p role="alert">{loadError}</p><button onClick={() => setRetry(value => value + 1)}>Thử lại</button></main>

  return <div className={styles.page} aria-busy={working}>
    <div className={styles.operationStatus} role="status">{working ? 'Đang xử lý…' : ''}</div>
    <div className={styles.editorContents} inert={working}>
    <header className={styles.header}>
      <Link href="/home" className={styles.logo}><Image src="/icons/logo.png" alt="" width={48} height={48} priority unoptimized /><span>RecipeShare<small>CLUB</small></span></Link>
      <div className={styles.breadcrumb}><span>Căn bếp của bạn</span><ChevronRight size={14} /><strong>{previewMode ? 'Xem trước bài viết' : 'Soạn bài viết'}</strong></div>
      <div className={styles.headerActions}><span className={styles.saveState}>{saved ? <Check size={14} /> : <span className={styles.dot} />}{saved ? 'Đã lưu trên máy chủ' : 'Bản nháp'}</span><button className={styles.secondary} aria-label={previewMode ? 'Về editor' : 'Xem trước bài viết'} aria-pressed={previewMode} onClick={() => switchPreview(!previewMode)}>{previewMode ? <FileText size={16} /> : <Eye size={16} />}<span>{previewMode ? 'Về editor' : 'Xem trước'}</span></button><button className={styles.primary} onClick={save}>{saved ? <Check key="saved" size={16} /> : <Save key="unsaved" size={16} />}<span>{saved ? 'Đã lưu nháp' : 'Lưu nháp'}</span></button></div>
    </header>
    {published&&!noticeHidden&&<div className={styles.managedNotice}><span>Đang sửa bài đã xuất bản. Người đọc vẫn thấy bản hiện tại cho đến khi bạn nhấn cập nhật.</span><Link href={`/posts/${postId}`} target="_blank">Xem bản đang xuất bản ↗</Link><button type="button" aria-label="Đóng thông báo chỉnh sửa" onClick={()=>setNoticeHidden(true)}><X size={16}/></button></div>}
    <div className={styles.modeBody}>
    <div ref={editorSurface} className={`${styles.layout} ${styles.editorMode}`} data-active={!previewMode} inert={previewMode} aria-hidden={previewMode}>
      <aside className={styles.sidebar}>
        <Link className={styles.back} href="/home"><ArrowLeft size={16} /><span>Về trang chủ</span></Link>
        <div className={styles.author}><span className={styles.avatar}>{user.displayName.slice(0, 1)}</span><div>{user.displayName}<small>{user.titleName}</small></div></div>
        <span className={styles.navCaption}>TRONG BÀI VIẾT</span>
        <nav><a href="#information" onClick={event => { event.preventDefault(); history.replaceState(history.state, '', '#information'); scrollWorkspace('information') }}><FileText size={17} /><span>Thông tin chung</span></a><EditorCollapse open={draft.type === 'recipe'}><a href="#ingredients" onClick={event => { event.preventDefault(); history.replaceState(history.state, '', '#ingredients'); scrollWorkspace('ingredients') }}><ListChecks size={17} /><span>Nguyên liệu</span><small>{draft.ingredients.length}</small></a></EditorCollapse><a href="#content" onClick={event => { event.preventDefault(); history.replaceState(history.state, '', '#content'); scrollWorkspace('content') }}><BookOpen size={17} /><span>Nội dung</span><small>{draft.blocks.length}</small></a></nav>
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
              <div ref={typeSwitch} className={styles.typeSwitch} role="group" aria-label="Loại bài viết"><span ref={typeMarker} className={styles.typeMarker} aria-hidden="true" /><button aria-pressed={draft.type === 'recipe'} disabled title="Loại bài được chọn khi tạo"><ChefHat size={15} />Công thức</button><button aria-pressed={draft.type === 'blog'} disabled title="Loại bài được chọn khi tạo"><BookOpen size={15} />Chuyện trong bếp</button></div>
              <label className={styles.field}>Tiêu đề<input value={draft.title} maxLength={200} onChange={e => change({ title: e.target.value })} placeholder="Đặt tên cho câu chuyện của bạn…" /></label>
              <label className={styles.field}>Mô tả ngắn<AutoTextarea value={draft.excerpt} maxRows={4} maxLength={500} rows={3} onChange={e => change({ excerpt: e.target.value })} placeholder="Điều gì làm món ăn này đặc biệt?" /><small>{draft.excerpt.length}/500</small></label>
              <div className={styles.tagLabel}><Tag size={14} />Danh mục bài viết</div>
              <div ref={tagList} className={styles.tags}>{draft.tags.map(item => <EditorTag key={item} name={item} onRemove={() => change({ tags: draft.tags.filter(t => t !== item) })} />)}<form className={styles.addTag} onSubmit={e => { e.preventDefault(); addTag() }}><input aria-label="Danh mục mới" value={tag} onChange={e => setTag(e.target.value)} placeholder="+ Thêm danh mục" maxLength={60} /><button aria-label="Thêm danh mục" type="submit"><Plus size={14} /></button></form></div>
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
          <button className={styles.addRow} disabled={draft.ingredients.length >= 200} onClick={() => change({ ingredients: [...draft.ingredients, { id: localId(), name: '', quantity: '', unit: '', note: '' }] })}><Plus size={15} />Thêm nguyên liệu</button>
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
                {block.type === 'list' && <div className={styles.listEditor}>
                  <ListStyleSelect value={block.listStyle} onChange={listStyle => updateBlock(block.id, { listStyle })} />
                  <AutoTextarea aria-label="Nội dung danh sách" rows={4} value={block.text} maxLength={60000} placeholder="Nhập các mục, mỗi dòng một mục…" onChange={event => updateBlock(block.id, { text: event.target.value })} />
                  <small>{listItems(block.text).length}/100 mục · Tối đa 500 ký tự mỗi mục</small>
                </div>}
                {block.type === 'paragraph' && <AutoTextarea aria-label="Nội dung đoạn văn" className={styles.paragraph} rows={4} value={block.text} maxLength={20000} placeholder="Kể câu chuyện, chia sẻ từng bước thực hiện…" onChange={e => updateBlock(block.id, { text: e.target.value })} />}
                {(block.type === 'image' || block.type === 'video') && <>
                  {block.type === 'video' && <div className={styles.videoModes}><button aria-pressed={block.mode === 'upload'} onClick={() => updateBlock(block.id, { mode: 'upload', src: '' })}><Upload size={14} />Tải video</button><button aria-pressed={block.mode === 'url'} onClick={() => updateBlock(block.id, { mode: 'url', src: '' })}>YouTube / URL</button></div>}
                  {block.type === 'video' && block.mode === 'url' && <label className={styles.field}>Đường dẫn video<input type="url" value={block.src} placeholder="https://www.youtube.com/watch?v=…" onChange={e => updateBlock(block.id, { src: e.target.value })} />{block.src && !source && <small>Nhập URL HTTPS của YouTube hoặc file MP4/WebM.</small>}</label>}
                  {block.src && block.type === 'image' ? <FadeImage className={styles.blockImage} src={block.src} alt={block.alt} /> : block.type === 'video' && source?.src ? <VideoPlayer className={styles.video} title={block.caption || 'Xem thử video'} src={source.src} youtube={source.youtube} /> : null}
                  {(block.type === 'image' || block.mode === 'upload') && <label className={block.src ? styles.replaceFile : styles.dropzone}><Upload size={block.src ? 15 : 25} /><strong>{block.src ? 'Chọn file khác' : block.type === 'image' ? 'Thêm một hình ảnh vào câu chuyện' : 'Chọn video hướng dẫn của bạn'}</strong>{!block.src && <small>{block.type === 'image' ? 'JPEG, PNG, WebP · Tối đa 5 MiB' : 'MP4, WebM · Tối đa 50 MiB'}</small>}<input type="file" accept={block.type === 'image' ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/webm'} onChange={e => { selectFile(e.target.files?.[0], block.type as 'image' | 'video', block.id); e.target.value = '' }} /></label>}
                  <input data-drag-video-extra className={styles.captionInput} aria-label="Chú thích media" placeholder="Thêm chú thích (không bắt buộc)" value={block.caption} maxLength={500} onChange={e => updateBlock(block.id, { caption: e.target.value })} />
                  {block.type === 'image' && <ImageAltField value={block.alt} onChange={alt => updateBlock(block.id, { alt })} />}
                </>}
              </div>
            </article>
          })}</div>
          <div className={styles.addBlock}><span>THÊM VÀO CÂU CHUYỆN</span><div>{(['heading', 'paragraph', 'list', 'image', 'video'] as const).map(type => { const Icon = blockIcons[type]; return <button key={type} onClick={() => addBlock(type)}><Icon size={17} />{blockLabels[type]}<Plus size={13} /></button> })}</div></div>
        </section>
        <footer className={styles.editorFooter}><Link href="/home"><ArrowLeft size={15} />Trở về căn bếp</Link><div className={styles.footerActions}><button className={styles.primary} onClick={save}>{saved ? <Check key="saved" size={16} /> : <Save key="unsaved" size={16} />}{saved ? 'Đã lưu nháp' : 'Lưu bản nháp'}</button><button className={styles.mobilePublish} onClick={previewPublication}><Send size={16} />Chia sẻ</button></div></footer>
      </main>
      <aside className={styles.previewPanel}>
        <div className={styles.previewPanelHeader}><span><Eye size={16} />Bài viết của bạn</span><span className={styles.liveBadge}><span />Xem trực tiếp</span></div>
        <Preview user={user} draft={draft} compact />
        <button className={styles.fullPreview} onClick={() => switchPreview(true)}>Mở bản xem trước <ChevronRight size={15} /></button>
        <PublishPanel draft={draft} onPublish={previewPublication} published={published} />
      </aside>
    </div>
    {previewMounted && <div className={styles.readingMode} data-active={previewMode} inert={!previewMode} aria-hidden={!previewMode} onTransitionEnd={event => {
      if (!previewMode && event.target === event.currentTarget && event.propertyName === 'opacity') setPreviewMounted(false)
    }}>
      <aside className={styles.readingNav}><span className={styles.navCaption}>TRONG BÀI VIẾT</span><button className={styles.secondary} onClick={() => switchPreview(false)}><ArrowLeft size={15} />Tiếp tục chỉnh sửa</button>{draft.blocks.filter(block => block.type === 'heading').map(block => <a key={block.id} href={`#preview-${block.id}`} onClick={event => { event.preventDefault(); scrollWorkspace(`preview-${block.id}`) }}>{block.text || 'Tiêu đề chưa đặt'}</a>)}</aside>
      <main className={styles.readingFeed}><div className={styles.readingNotice}><Eye size={15} /><span>Bản xem trước · Nội dung chưa xuất bản</span></div><Preview user={user} draft={draft} /></main>
      <aside className={styles.readingAside}><PublishPanel draft={draft} onPublish={previewPublication} published={published} /></aside>
    </div>}
    </div>
    </div>
    <UnsavedChanges dirty={!saved} onSave={save}/>
    <AuthToast message={notice} />
  </div>
}

'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bookmark } from 'lucide-react'
import styles from './save-post-button.module.css'

export function SavePostButton({ id, title }: { id: string; title: string }) {
  const [saved, setSaved] = useState(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [guest, setGuest] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [revision, setRevision] = useState(0)
  const lock = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    async function read() {
      try {
        const response = await fetch(`/api/posts/${id}/save`, { cache: 'no-store', signal: controller.signal })
        if (response.status === 401) { setGuest(true); setSaved(false); setReady(true); return }
        if (!response.ok) throw new Error()
        const data = await response.json()
        if (!controller.signal.aborted) { setSaved(data.saved); setGuest(false); setReady(true); setError('') }
      } catch { if (!controller.signal.aborted) { setError('Không tải được trạng thái lưu.'); setReady(false) } }
    }
    function sync(event: Event) { const detail = (event as CustomEvent<{ id: string; saved: boolean }>).detail; if (detail.id === id) setSaved(detail.saved) }
    void read(); window.addEventListener('focus', read); window.addEventListener('saved-post-changed', sync)
    return () => { controller.abort(); window.removeEventListener('focus', read); window.removeEventListener('saved-post-changed', sync) }
  }, [id, retry])
  async function toggle() {
    if (lock.current || !ready) return
    lock.current = true; setBusy(true); setError('')
    try {
      const response = await fetch(`/api/posts/${id}/save`, { method: saved ? 'DELETE' : 'PUT' })
      if (response.status === 401) { setGuest(true); return }
      if (!response.ok) throw new Error()
      const data = await response.json()
      setSaved(data.saved); setRevision(value => value + 1)
      window.dispatchEvent(new CustomEvent('saved-post-changed', { detail: { id, saved: data.saved } }))
    } catch { setError('Chưa lưu được thay đổi. Hãy thử lại.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <span className={styles.wrap}>{guest ? <Link className={styles.button} href="/" title="Đăng nhập để lưu bài"><Bookmark size={17} />Lưu bài viết</Link> : <button className={styles.button} type="button" aria-pressed={saved} aria-label={`${saved ? 'Bỏ lưu' : 'Lưu'}: ${title}`} disabled={!ready || busy} aria-busy={busy} onClick={toggle}><span key={revision} className={revision ? styles.changed : undefined}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /></span><span>{busy ? 'Đang lưu…' : saved ? 'Đã lưu' : 'Lưu bài viết'}</span></button>}{error && <small role="alert">{error}{!ready && <button type="button" onClick={() => setRetry(value => value + 1)}>Thử lại</button>}</small>}</span>
}

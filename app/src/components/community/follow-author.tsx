'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Users } from 'lucide-react'
import styles from './following.module.css'

type Status = { following: boolean; own: boolean; authenticated: boolean }
export function FollowAuthor({ username, initialFollowing }: { username: string; initialFollowing?: boolean }) {
  const [status, setStatus] = useState<Status | null>(() => initialFollowing === undefined ? null : { following: initialFollowing, own: false, authenticated: true })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const lock = useRef(false)
  const generation = useRef(0)
  useEffect(() => {
    const controller = new AbortController()
    async function read() {
      if (lock.current) return
      const request = ++generation.current
      try {
        const response = await fetch(`/api/profiles/${encodeURIComponent(username)}/follow`, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error()
        const data: Status = await response.json()
        if (!controller.signal.aborted && request === generation.current) { setStatus(data); setError('') }
      } catch { if (!controller.signal.aborted && request === generation.current) setError('Chưa tải được trạng thái theo dõi.') }
    }
    function sync(event: Event) {
      const detail = (event as CustomEvent<{ username: string; status: Status }>).detail
      if (detail.username.toLowerCase() === username.toLowerCase()) { generation.current++; setStatus(detail.status) }
    }
    if (initialFollowing === undefined || retry > 0) void read()
    window.addEventListener('follow-changed', sync); window.addEventListener('focus', read)
    return () => { controller.abort(); window.removeEventListener('follow-changed', sync); window.removeEventListener('focus', read) }
  }, [username, retry, initialFollowing])
  async function toggle() {
    if (!status || lock.current) return
    generation.current++; lock.current = true; setBusy(true); setError('')
    try {
      const response = await fetch(`/api/profiles/${encodeURIComponent(username)}/follow`, { method: status.following ? 'DELETE' : 'PUT' })
      if (response.status === 401) { setStatus({ ...status, authenticated: false }); return }
      if (!response.ok) throw new Error()
      const data: Status = await response.json(); setStatus(data)
      window.dispatchEvent(new CustomEvent('follow-changed', { detail: { username, status: data } }))
    } catch { setError('Chưa thể thay đổi theo dõi. Hãy thử lại.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <div className={styles.followControl}>

    {status?.own ? null : status && !status.authenticated ? <Link href="/" className={styles.followButton}><Users size={15} />Đăng nhập để theo dõi</Link> : <button type="button" className={styles.followButton} aria-label={`${status?.following ? 'Bỏ theo dõi' : 'Theo dõi'} ${username}`} aria-pressed={status?.following ?? false} disabled={!status || busy} onClick={toggle}>{status?.following ? <Check size={15} /> : <Users size={15} />}{busy ? 'Đang xử lý…' : status?.following ? 'Đang theo dõi' : 'Theo dõi'}</button>}
    {error && <small role="alert">{error}{!status && <button onClick={() => setRetry(value => value + 1)}>Thử lại</button>}</small>}
  </div>
}

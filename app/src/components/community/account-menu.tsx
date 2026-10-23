'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ChevronDown, LogOut, Settings, UserRound } from 'lucide-react'
import type { SessionUser } from './types'
import styles from './account-menu.module.css'

export function AccountMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const first = useRef<HTMLButtonElement>(null)
  const id = useId()
  const router = useRouter()
  useEffect(() => {
    if (!open) return
    first.current?.focus({ preventScroll: true })
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setClosing(true)
    }
    function keyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') { setClosing(true); trigger.current?.focus({ preventScroll: true }) }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', keyboard)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', keyboard) }
  }, [open])
  async function logout() {
    if (pending) return
    setPending(true)
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error()
      router.replace('/home')
      router.refresh()
    } catch { setNotice('Không thể đăng xuất. Vui lòng thử lại.'); setPending(false) }
  }
  function toggle() {
    if (open) setClosing(true)
    else { setNotice(''); setClosing(false); setOpen(true) }
  }
  return <div className={styles.root} ref={root} onBlur={event => {
    if (open && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setClosing(true)
  }}>
    <button ref={trigger} className={styles.card} onClick={toggle} aria-expanded={open && !closing} aria-controls={open ? id : undefined} aria-haspopup="dialog">
      <span className={styles.name}>{user.displayName}<small>{user.titleName}</small></span><span className={styles.avatar}>{user.avatarUrl ? <Image src={user.avatarUrl} alt="" width={36} height={36} unoptimized /> : user.displayName.slice(0, 1).toUpperCase()}<i /></span><ChevronDown size={13} aria-hidden="true" />
    </button>
    {open && <div id={id} role="dialog" aria-label="Tài khoản của bạn" className={`${styles.panel} ${closing ? styles.closing : ''}`} onAnimationEnd={event => {
      if (closing && event.target === event.currentTarget) { setOpen(false); setClosing(false) }
    }} inert={closing}>
      <div className={styles.heading}><span>GÓC RIÊNG CỦA BẠN</span><strong>Chào {user.displayName}</strong><small>@{user.username}</small></div>
      <button ref={first} onClick={() => { setClosing(true); router.push('/profile') }}><UserRound size={17} />Trang cá nhân</button>
      <button onClick={() => setNotice('Các tuỳ chọn cài đặt sẽ được bổ sung ở bước tiếp theo.')}><Settings size={17} />Cài đặt</button>
      <button className={styles.logout} disabled={pending} onClick={logout}><LogOut size={17} />{pending ? 'Đang đăng xuất…' : 'Đăng xuất'}</button>
      {notice && <p className={styles.notice} role="status">{notice}</p>}
    </div>}
  </div>
}

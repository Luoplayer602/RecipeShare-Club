'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { LockKeyhole, Mail, UserRound } from 'lucide-react'
import { InteractiveAmbient } from '@/components/interactive-ambient'
import { SignupContact } from '@/components/signup-contact'
import { PasswordToggle } from '@/components/password-toggle'
import { AuthToast } from '@/components/auth-toast'

function TrayMark() {
  return (
    <svg className="tray-mark" viewBox="0 0 160 112" role="img" aria-label="Đĩa có nắp">
      <ellipse cx="80" cy="104" rx="67" ry="5" fill="#111827" opacity=".12" />
      <path d="M24 76h112l-7 11H31l-7-11Z" fill="#d4d7dc" stroke="#737985" strokeWidth="2" />
      <path d="M31 76c1-33 21-55 49-55s48 22 49 55H31Z" fill="#eef0f2" stroke="#737985" strokeWidth="2" />
      <path d="M43 69c4-24 17-38 37-42 14-3 28 1 37 10-2 16-17 24-35 27-17 3-29 7-39 5Z" fill="#fff" opacity=".72" />
      <path d="M73 20c0-8 4-12 10-12s10 4 10 12" fill="#e3e5e7" stroke="#737985" strokeWidth="2" />
      <path d="M12 76h136" stroke="#737985" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export default function Page() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [entering, setEntering] = useState(true)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [switching, setSwitching] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [notice, setNotice] = useState('')
  const [reopening, setReopening] = useState(false)
  const signup = mode === 'signup'
  const busy = entering || switching || submitted

  useEffect(() => {
    if (!submitted) return
    const timer = window.setTimeout(() => router.push('/home'), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1580)
    return () => window.clearTimeout(timer)
  }, [submitted, router])

  useEffect(() => {
    if (!entering) return
    const timer = window.setTimeout(() => {
      setEntering(false)
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1000)
    return () => window.clearTimeout(timer)
  }, [entering])

  useEffect(() => {
    if (!switching) return
    const timer = window.setTimeout(() => {
      setPassword('')
      setConfirmation('')
      setShowPassword(false)
      setShowConfirmation(false)
      setEntering(true)
      setReopening(true)
      setMode(signup ? 'login' : 'signup')
      setSwitching(false)
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 880)
    return () => window.clearTimeout(timer)
  }, [switching, signup])

  function switchMode() {
    if (busy) return
    setNotice('')
    setSwitching(true)
  }

  return (
    <main className={`login-stage${submitted ? ' is-submitting' : ''}${reopening ? ' is-reopening' : ''}${switching ? ' is-switching' : ''}${signup ? ' is-signup' : ''}`}>
      <InteractiveAmbient className="ambient-one" />
      <InteractiveAmbient className="ambient-two" />
      <InteractiveAmbient className="ambient-three" />
      <InteractiveAmbient className="ambient-four" />
      <InteractiveAmbient className="ambient-five" />
      <section className="login-shell" aria-label={signup ? 'Đăng ký' : 'Đăng nhập'}>
        <div className="brand-mark"><TrayMark /></div>
        <div key={mode} className="login-card" aria-busy={switching || submitted} inert={switching || submitted}>
          <div className="card-heading">
            <p className="eyebrow">{signup ? 'JOIN THE CLUB' : 'WELCOME BACK'}</p>
            <h1>{signup ? 'Đăng ký' : 'Đăng nhập'}</h1>
            <p className="subheading">{signup ? 'Tạo tài khoản để cùng chia sẻ những món ngon.' : 'Chào mừng bạn trở lại. Hãy đăng nhập để tiếp tục.'}</p>
          </div>

          <form className="login-form" noValidate onSubmit={(event) => {
            event.preventDefault()
            if (!busy) { setNotice(signup ? 'Thông tin đăng ký đã được ghi nhận.' : 'Thông tin đăng nhập đã được ghi nhận.'); setSubmitted(true) }
          }}>
            <div className={signup ? 'signup-grid' : 'login-fields'}>
              <div className="signup-details">
                {signup ? <>
                  <SignupContact />
                  <div className="auth-field">
                    <label className="field-label" htmlFor="signup-username">Username</label>
                    <div className="input-wrap">
                      <UserRound aria-hidden="true" />
                      <input id="signup-username" name="username" placeholder="Ví dụ: minhan" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={32} />
                    </div>
                  </div>
                  <div className="auth-field">
                    <label className="field-label" htmlFor="signup-display-name">Tên hiển thị</label>
                    <div className="input-wrap">
                      <UserRound aria-hidden="true" />
                      <input id="signup-display-name" name="displayName" placeholder="Tên mọi người nhìn thấy" autoComplete="nickname" maxLength={80} />
                    </div>
                  </div>
                </> : <>
                  <label className="field-label" htmlFor="identifier">Username / Email / Phone</label>
                  <div className="input-wrap">
                    <UserRound aria-hidden="true" />
                    <input id="identifier" value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder="Nhập username, email hoặc phone" autoComplete="username" />
                  </div>
                </>}
              </div>
              <div className="signup-passwords"><div className="auth-field password-field">
                <div className="password-heading">
                  <label className="field-label" htmlFor="password">{signup ? 'Nhập mật khẩu mới' : 'Mật khẩu'}</label>
                </div>
                <div className="input-wrap">
                  <LockKeyhole aria-hidden="true" />
                  <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} placeholder={signup ? 'Nhập mật khẩu mới' : 'Nhập mật khẩu'} autoComplete={signup ? 'new-password' : 'current-password'} />
                  <PasswordToggle visible={showPassword} onToggle={() => setShowPassword(value => !value)} inputId="password" label="mật khẩu" />
                </div>
                </div>{signup && <div className="auth-field confirmation-field">
                  <div className="password-heading"><label className="field-label" htmlFor="confirmation">Nhập lại mật khẩu</label></div>
                  <div className="input-wrap">
                    <LockKeyhole aria-hidden="true" />
                    <input id="confirmation" type={showConfirmation ? 'text' : 'password'} value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder="Nhập lại mật khẩu mới" autoComplete="new-password" />
                    <PasswordToggle visible={showConfirmation} onToggle={() => setShowConfirmation(value => !value)} inputId="confirmation" label="mật khẩu nhập lại" />
                  </div>
                </div>}
              </div>
            </div>
            {!signup && <a className="forgot-link" href="#forgot">Quên mật khẩu?</a>}
            <button className="submit-button" type="submit" disabled={busy}>{signup ? 'Tạo tài khoản' : 'Đăng nhập'} <span aria-hidden="true">→</span></button>
          </form>

          <div className="divider"><span>hoặc tiếp tục với</span></div>
          <div className="social-row">
            <button className="social-button" type="button" disabled={busy} onClick={() => setSubmitted(true)}><Image src="/icons/Google__G__logo.svg" alt="" width={18} height={18} unoptimized /> Google</button>
            <button className="social-button" type="button" disabled={busy} onClick={() => setSubmitted(true)}><Image src="/icons/2023_Facebook_icon.svg" alt="" width={18} height={18} unoptimized /> Facebook</button>
          </div>
          <p className="signup-copy">{signup ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}
            <a href={signup ? '#login' : '#signup'} aria-disabled={busy} onClick={(event) => { event.preventDefault(); switchMode() }}>{signup ? 'Đăng nhập ngay' : 'Đăng ký ngay'}</a>
          </p>
        </div>
      </section>
      <AuthToast message={notice} />
      <p className="reference-note"><Mail aria-hidden="true" /> Bảo mật &amp; riêng tư là ưu tiên của chúng tôi</p>
    </main>
  )
}

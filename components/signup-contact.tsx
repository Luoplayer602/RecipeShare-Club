'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Mail, Phone, Search, X } from 'lucide-react'
import styles from './signup-contact.module.css'

const countries = [
  { code: 'VN', name: 'Việt Nam', dial: '+84', flag: '🇻🇳' },
  { code: 'US', name: 'Hoa Kỳ', dial: '+1', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { code: 'GB', name: 'Vương quốc Anh', dial: '+44', flag: '🇬🇧' },
  { code: 'AU', name: 'Úc', dial: '+61', flag: '🇦🇺' },
  { code: 'JP', name: 'Nhật Bản', dial: '+81', flag: '🇯🇵' },
  { code: 'KR', name: 'Hàn Quốc', dial: '+82', flag: '🇰🇷' },
  { code: 'SG', name: 'Singapore', dial: '+65', flag: '🇸🇬' },
  { code: 'TH', name: 'Thái Lan', dial: '+66', flag: '🇹🇭' },
  { code: 'FR', name: 'Pháp', dial: '+33', flag: '🇫🇷' },
  { code: 'DE', name: 'Đức', dial: '+49', flag: '🇩🇪' },
]

export function SignupContact() {
  const [method, setMethod] = useState<'email' | 'phone'>('email')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState(countries[0])
  const [search, setSearch] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const phoneInput = useRef<HTMLInputElement>(null)
  const closingAnimation = useRef<Animation | null>(null)

  const closeCountries = useCallback((focusPhone = false) => {
    const menu = dialog.current
    if (!menu?.open || closingAnimation.current) return

    const finish = () => {
      menu.close()
      if (focusPhone) phoneInput.current?.focus({ preventScroll: true })
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish()
      return
    }

    const animation = menu.animate([
      { opacity: 1, transform: 'translateX(0) scale(1)' },
      { opacity: 0, transform: 'translateX(14px) scale(.94)' },
    ], { duration: 280, easing: 'cubic-bezier(.64, 0, .78, 0)', fill: 'forwards' })
    closingAnimation.current = animation
    animation.onfinish = () => {
      finish()
      animation.cancel()
      closingAnimation.current = null
    }
  }, [])
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase()
  const matches = countries.filter(item => normalize(`${item.name} ${item.code} ${item.dial}`).includes(normalize(search.trim())))

  useEffect(() => {
    function close() { closeCountries() }
    function onScroll(event: Event) {
      if (event.target instanceof Node && dialog.current?.contains(event.target)) return
      close()
    }
    window.addEventListener('resize', close)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', onScroll, true)
      closingAnimation.current?.cancel()
      closingAnimation.current = null
    }
  }, [closeCountries])

  function openCountries() {
    const menu = dialog.current
    const anchor = trigger.current?.getBoundingClientRect()
    if (!menu || !anchor) return
    const width = Math.min(280, window.innerWidth - 24)
    const height = Math.min(340, window.innerHeight - 32)
    const fitsLeft = anchor.left >= width + 24
    const left = fitsLeft ? anchor.left - width - 12 : Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12))
    const top = Math.max(12, Math.min(fitsLeft ? anchor.top : anchor.bottom + 8, window.innerHeight - height - 12))
    menu.style.left = `${left}px`
    menu.style.top = `${top}px`
    menu.style.width = `${width}px`
    menu.style.height = `${height}px`
    menu.showModal()
  }

  return <div className={styles.contact}>
    <fieldset className={styles.switch} data-method={method}>
      <legend className="sr-only">Đăng ký bằng email hoặc số điện thoại</legend>
      <span className={styles.thumb} aria-hidden="true" />
      {(['email', 'phone'] as const).map(item => <label key={item} className={styles.segment}>
        <input className="sr-only" type="radio" name="contactMethod" value={item} checked={method === item} onChange={() => setMethod(item)} />
        {item === 'email' ? <Mail size={14} aria-hidden="true" /> : <Phone size={14} aria-hidden="true" />}
        <span>{item === 'email' ? 'Email' : 'Điện thoại'}</span>
      </label>)}
    </fieldset>
    <div className={styles.fields} data-method={method}>
      <div className={styles.emailField} inert={method !== 'email'} aria-hidden={method !== 'email'}>
        <label className="field-label" htmlFor="signup-email">Địa chỉ email</label>
        <div className="input-wrap"><Mail aria-hidden="true" /><input id="signup-email" name="email" type="email" autoComplete="email" placeholder="ban@example.com" value={email} onChange={event => setEmail(event.target.value)} disabled={method !== 'email'} /></div>
      </div>
      <div className={styles.phoneField} inert={method !== 'phone'} aria-hidden={method !== 'phone'}>
        <label className="field-label" htmlFor="signup-phone">Số điện thoại</label>
        <div className={`input-wrap ${styles.phoneWrap}`}>
          <button ref={trigger} type="button" className={styles.countryTrigger} onClick={openCountries} aria-label={`Chọn quốc gia, hiện tại ${country.name} ${country.dial}`} aria-haspopup="dialog"><span aria-hidden="true">{country.flag}</span><span>{country.dial}</span><ChevronDown size={12} aria-hidden="true" /></button>
          <input ref={phoneInput} id="signup-phone" name="phoneNational" type="tel" inputMode="tel" autoComplete="tel-national" placeholder={country.code === 'VN' ? '090 123 4567' : 'Số điện thoại của bạn'} value={phone} onChange={event => setPhone(event.target.value)} disabled={method !== 'phone'} />
          <input type="hidden" name="phoneCountry" value={country.code} disabled={method !== 'phone'} />
          <input type="hidden" name="phoneDialCode" value={country.dial} disabled={method !== 'phone'} />
        </div>
      </div>
    </div>
    <dialog ref={dialog} className={styles.countryMenu} aria-labelledby="country-title" onCancel={event => { event.preventDefault(); closeCountries() }} onClose={() => setSearch('')} onClick={event => {
      if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect()
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeCountries()
      }
    }}>
      <div className={styles.menuHeading}><h2 id="country-title">Quốc gia / Vùng</h2><button type="button" aria-label="Đóng chọn quốc gia" onClick={() => closeCountries()}><X size={15} /></button></div>
      <label className={styles.search}><Search size={14} aria-hidden="true" /><input aria-label="Tìm quốc gia hoặc mã vùng" placeholder="Tìm quốc gia, mã vùng…" value={search} onChange={event => setSearch(event.target.value)} autoFocus /></label>
      <div className={styles.countryList}>{matches.map(item => <button type="button" key={item.code} aria-pressed={country.code === item.code} onClick={() => { setCountry(item); closeCountries(true) }}><span aria-hidden="true">{item.flag}</span><span>{item.name}<small>{item.code}</small></span><span>{item.dial}</span>{country.code === item.code && <Check size={14} aria-hidden="true" />}</button>)}{!matches.length && <p className={styles.empty} role="status">Không tìm thấy quốc gia phù hợp.</p>}</div>
    </dialog>
  </div>
}

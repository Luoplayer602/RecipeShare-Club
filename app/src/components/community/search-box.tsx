'use client'
import {useEffect,useId,useRef,useState} from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {useRouter} from 'next/navigation'
import {Search,X} from 'lucide-react'
import {parseSearch} from '@/lib/posts/search'
import styles from './search-box.module.css'

type Person={id:string;username:string;displayName:string;avatarUrl:string|null;titleName:string}
export function SearchBox({query,onQuery}:{query?:string;onQuery?:(value:string)=>void}){
  const router=useRouter(),id=useId(),root=useRef<HTMLDivElement>(null)
  const [localValue,setValue]=useState(''),[focused,setFocused]=useState(false),[help,setHelp]=useState(false)
  const value=query??localValue
  const [received,setResult]=useState<{key:string;users:Person[];total:number}|null>(null),[failure,setError]=useState({key:'',message:''}),[active,setActive]=useState(-1)
  const result=received?.key===value?received:null,error=failure.key===value?failure.message:''
  const parsed=parseSearch(value),people=parsed.peopleOnly && parsed.valid
  const open=focused && people && !help
  const pending=open&&!parsed.incomplete&&!result&&!error
  useEffect(()=>{
    if(!people || !focused || parsed.incomplete)return
    const controller=new AbortController()
    const timer=setTimeout(async()=>{
      try{
        const response=await fetch(`/api/profiles?${new URLSearchParams({q:value})}`,{signal:controller.signal,cache:'no-store'})
        if(!response.ok)throw Error('Chưa thể tìm người dùng. Bạn thử lại nhé.')
        const data=await response.json()
        if(!controller.signal.aborted){setResult({...data,key:value});setError({key:value,message:''})}
      }catch(error){if(!controller.signal.aborted)setError({key:value,message:error instanceof Error?error.message:'Không kết nối được máy chủ.'})}
    },400)
    return()=>{clearTimeout(timer);controller.abort()}
  },[value,people,focused,parsed.incomplete])
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node)){setFocused(false);setHelp(false)}}
    document.addEventListener('pointerdown',outside)
    return()=>document.removeEventListener('pointerdown',outside)
  },[])
  function change(next:string){if(onQuery)onQuery(next);else setValue(next);setActive(-1);setFocused(true)}
  return <div className={styles.area} ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node)){setFocused(false);setHelp(false)}}} onKeyDown={event=>{if(event.key==='Escape'){setFocused(false);setHelp(false);event.stopPropagation()}}}>
    <form action="/home" className={styles.search} onSubmit={event=>{
      if(people){event.preventDefault();if(active>=0&&result?.users[active]){setFocused(false);router.push(`/profile/${encodeURIComponent(result.users[active].username)}`)}}
      else if(onQuery){event.preventDefault();onQuery(value)}
    }}>
      <Search size={19} aria-hidden="true"/>
      <input name="q" aria-label="Tìm bài viết hoặc người dùng" placeholder="Tìm món ăn, #danh mục, @username, %nguyên liệu…" maxLength={300} value={value} onChange={event=>change(event.target.value)} onFocus={()=>setFocused(true)} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={id+'-people'} aria-activedescendant={open&&active>=0?id+'-person-'+active:undefined} onKeyDown={event=>{
        if(!open||!result?.users.length)return
        if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setActive(index=>index<0?(event.key==='ArrowDown'?0:result.users.length-1):(index+(event.key==='ArrowDown'?1:-1)+result.users.length)%result.users.length)}
      }}/>
      {value&&<button type="button" aria-label="Xóa tìm kiếm" onClick={()=>{change('');root.current?.querySelector('input')?.focus()}}><X size={16}/></button>}
    </form>
    <div className={styles.helpArea} data-open={help} onPointerEnter={event=>{if(event.pointerType!=='touch')setHelp(true)}} onPointerLeave={()=>setHelp(false)}>
      <button type="button" className={styles.helpButton} aria-label="Hướng dẫn tìm kiếm" aria-expanded={help} aria-describedby={help?id+'-help':undefined} onFocus={event=>{if(event.target.matches(':focus-visible'))setHelp(true)}} onClick={()=>setHelp(true)}>?</button>
      <div id={id+'-help'} className={styles.helpPopup} data-open={help} role="tooltip" aria-hidden={!help}>
        <strong>Tìm một chút, thấy điều ngon</strong>
        <p>Gõ tên món để tìm bài viết, hoặc dùng:</p>
        <dl><div><dt>#món chay</dt><dd>Tìm theo danh mục (tag)</dd></div><div><dt>@minhan</dt><dd>Tìm người dùng theo username</dd></div><div><dt>%nấm</dt><dd>Tìm công thức có nguyên liệu</dd></div></dl>
        <p>Có thể kết hợp: <b>@minhan #món chay %nấm</b>. Bài viết sẽ khớp tất cả điều kiện.</p>
        <small>Mỗi cụm kết thúc khi gặp ký hiệu tiếp theo. Kết quả cập nhật sau khi bạn ngừng gõ một chút.</small>
      </div>
    </div>
    <div className={styles.peoplePopup} data-open={open} aria-hidden={!open}>
      <div className={styles.peopleHeading}>Những căn bếp phù hợp</div>
      {parsed.incomplete?<p>Nhập username sau dấu @ để tìm người dùng.</p>:pending?<p role="status">Đang tìm những căn bếp…</p>:error?<p role="alert">{error}</p>:result&&!result.users.length?<p>Chưa có username phù hợp.</p>:null}
      <ul id={id+'-people'} role="listbox" aria-label="Kết quả tìm người dùng">{result?.users.map((person,index)=><li key={person.id} id={id+'-person-'+index} role="option" aria-selected={active===index}><Link href={`/profile/${encodeURIComponent(person.username)}`} tabIndex={open?0:-1} onClick={()=>setFocused(false)}><span className={styles.avatar}>{person.avatarUrl?<Image src={person.avatarUrl} alt="" width={36} height={36} unoptimized/>:person.displayName.slice(0,1).toUpperCase()}</span><span><strong>{person.displayName}</strong><small>@{person.username} · {person.titleName}</small></span></Link></li>)}</ul>
      {result&&result.total>8&&<p>Có {result.total} người dùng phù hợp. Thêm ký tự để thu hẹp kết quả.</p>}
    </div>
  </div>
}

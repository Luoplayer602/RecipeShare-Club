'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { MoreHorizontal, Pencil, FileText, Trash2, X } from 'lucide-react'


import styles from '../post-actions.module.css'

export function PostActions({ id, title, published=true, onDone }: { id:string; title:string; published?:boolean; onDone?:()=>void }) {
  const [open,setOpen]=useState(false)
  const [confirm,setConfirm]=useState<'delete'|'unpublish'|null>(null)
  const [error,setError]=useState(''),[busy,setBusy]=useState(false)
  const [point,setPoint]=useState({top:0,left:0})
  const trigger=useRef<HTMLButtonElement>(null)
  const menu=useRef<HTMLDivElement>(null)
  const dialog=useRef<HTMLDialogElement>(null)
  useEffect(()=>{
    if(!open)return
    menu.current?.querySelector<HTMLElement>('a,button')?.focus({preventScroll:true})
    function outside(event:PointerEvent){if(!menu.current?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node))setOpen(false)}
    function key(event:KeyboardEvent){if(event.key==='Escape'){setOpen(false);trigger.current?.focus()}}
    function close(){setOpen(false)}
    function position(){const rect=trigger.current?.getBoundingClientRect();if(!rect)return;setPoint({top:Math.max(12,Math.min(rect.bottom+8,innerHeight-190)),left:Math.max(12,Math.min(rect.right-230,innerWidth-242))})}
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);window.addEventListener('resize',close);window.addEventListener('scroll',position,true)
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);window.removeEventListener('resize',close);window.removeEventListener('scroll',position,true)}
  },[open])
  useEffect(()=>{if(confirm)dialog.current?.showModal()},[confirm])
  function ask(action:'delete'|'unpublish'){setOpen(false);setError('');setConfirm(action)}
  async function apply(){
    if(busy)return;setBusy(true);setError('')
    try{
      const response=await fetch(`/api/posts/${id}/manage`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:confirm==='delete'?'delete':'unpublish'})})
      if(!response.ok)throw new Error(response.status===401?'Phiên đăng nhập đã hết.':response.status===404?'Bài viết không còn khả dụng.':'Không lưu được thay đổi. Hãy thử lại.')
      window.dispatchEvent(new Event('post-managed'));dialog.current?.close();onDone?.()
    }catch(error){setError(error instanceof Error?error.message:'Không lưu được thay đổi.')}finally{setBusy(false)}
  }
  return <>
    <button ref={trigger} type="button" className={styles.trigger} aria-label={`Tùy chọn bài viết: ${title}`} aria-expanded={open} aria-haspopup="dialog" onClick={()=>{const rect=trigger.current!.getBoundingClientRect();setPoint({top:Math.max(12,Math.min(rect.bottom+8,innerHeight-190)),left:Math.max(12,Math.min(rect.right-230,innerWidth-242))});setOpen(value=>!value)}}><MoreHorizontal size={20}/></button>
    {open&&createPortal(<div ref={menu} className={styles.menu} style={point} role="dialog" aria-label={`Quản lý ${title}`}><Link href={`/editor/${id}`} onClick={()=>setOpen(false)}><Pencil size={16}/>{published?'Chỉnh sửa bài viết':'Tiếp tục viết'}</Link>{published&&<button onClick={()=>ask('unpublish')}><FileText size={16}/>Chuyển về bản nháp</button>}<button className={styles.danger} onClick={()=>ask('delete')}><Trash2 size={16}/>{published?'Xóa bài viết':'Xóa bản nháp'}</button></div>,document.body)}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={`confirm-post-${id??'new'}`} onCancel={event=>{if(busy)event.preventDefault()}} onClose={()=>{setConfirm(null);trigger.current?.focus()}}>
      {confirm && <><button disabled={busy} className={styles.close} aria-label="Đóng xác nhận" onClick={()=>dialog.current?.close()}><X size={19}/></button>
      <span className={styles.eyebrow}>CĂN BẾP CỦA BẠN</span><h2 id={`confirm-post-${id??'new'}`}>{confirm==='delete'?(published?'Xóa bài viết này?':'Xóa bản nháp này?'):'Chuyển bài về bản nháp?'}</h2><p><strong>{title}</strong></p><p>{confirm==='delete'?'Bài viết sẽ được xóa khỏi trang của bạn. Thao tác không thể hoàn tác.':'Bài viết sẽ ẩn khỏi các trang đọc. Bạn có thể tiếp tục chỉnh sửa và xuất bản lại bất cứ lúc nào.'}</p>{error&&<p role="alert">{error}</p>}<div className={styles.buttons}><button autoFocus disabled={busy} onClick={()=>dialog.current?.close()}>Giữ lại</button><button disabled={busy} className={confirm==='delete'?styles.delete:styles.primary} onClick={apply}>{confirm==='delete'?(published?'Xóa bài viết':'Xóa bản nháp'):'Chuyển về nháp'}</button></div></>}
    </dialog>
  </>
}

'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Camera, Pencil, Upload } from 'lucide-react'
import styles from './photo-menu.module.css'

export function PhotoMenu({kind,canEdit,disabled,className,onEdit,onUpload}:{kind:'cover'|'avatar';canEdit:boolean;disabled:boolean;className:string;onEdit:()=>void;onUpload:(file:File)=>void}) {
  const [open,setOpen]=useState(false),[point,setPoint]=useState({top:0,left:0})
  const trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),id=useId()
  const label=kind==='cover'?'ảnh bìa':'ảnh đại diện'
  function position(){const rect=trigger.current?.getBoundingClientRect();if(rect)setPoint({top:Math.max(8,Math.min(rect.bottom+8,innerHeight-118)),left:Math.max(8,Math.min(rect.right-216,innerWidth-224))})}
  function close(focus=true){setOpen(false);if(focus)trigger.current?.focus({preventScroll:true})}
  useEffect(()=>{
    if(!open)return
    menu.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus({preventScroll:true})
    function outside(event:PointerEvent){if(!menu.current?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node))setOpen(false)}
    function key(event:KeyboardEvent){
      if(event.key==='Escape'){event.preventDefault();close()}
      if(event.key==='Tab')setOpen(false)
      if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
        event.preventDefault();const items=Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]),index=items.indexOf(document.activeElement as HTMLButtonElement)
        const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length
        items[next]?.focus({preventScroll:true})
      }
    }
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);window.addEventListener('resize',position);window.addEventListener('scroll',position,true)
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true)}
  },[open])
  return <><button ref={trigger} type="button" className={className} disabled={disabled} aria-label={`Tùy chọn ${label}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>{position();setOpen(value=>!value)}}><Camera size={17}/></button>
    <input ref={input} hidden data-photo-input={kind} type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Tải lên ${label}`} disabled={disabled} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)onUpload(file)}}/>
    {open&&createPortal(<div ref={menu} id={id} role="menu" aria-label={`Tùy chọn ${label}`} className={styles.menu} style={point}><button type="button" role="menuitem" disabled={!canEdit} onClick={()=>{close();onEdit()}}><Pencil size={16}/>Chỉnh sửa ảnh</button><button type="button" role="menuitem" onClick={()=>{close();input.current?.click()}}><Upload size={16}/>Tải lên {label}</button></div>,document.body)}
  </>
}

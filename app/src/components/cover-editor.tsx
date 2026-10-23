'use client'
import { useEffect, useRef, useState } from 'react'
import NextImage from 'next/image'
import { X, Check } from 'lucide-react'
import { cropRect, resizeCrop, defaultCrop, type CropSettings } from '@/lib/image-crop'
import styles from './cover-editor.module.css'

type Props = {source:string; kind:'cover'|'avatar'; ratio:number; initial?:CropSettings; onClose:()=>void; onApply:(image:string,settings:CropSettings)=>void|Promise<void>}
export function CoverEditor({source,kind,ratio,initial,onClose,onApply}:Props) {
  const dialog=useRef<HTMLDialogElement>(null),image=useRef<HTMLImageElement|null>(null),stage=useRef<HTMLDivElement>(null)
  const drag=useRef<{x:number;y:number;mode:'move'|'resize';settings:CropSettings}|null>(null)
  const [settings,setSettings]=useState<CropSettings>(()=>({...defaultCrop,...initial,ratio}))
  const [size,setSize]=useState({width:0,height:0}),[error,setError]=useState(''),[saving,setSaving]=useState(false)
  const label=kind==='cover'?'ảnh bìa':'ảnh đại diện'
  const loaded=size.width>0,rect=loaded?cropRect(size.width,size.height,settings):null
  useEffect(()=>{
    dialog.current?.showModal()
    let cancelled=false
    const img=new Image();img.onload=()=>{if(!cancelled){image.current=img;setSize({width:img.naturalWidth,height:img.naturalHeight})}};img.onerror=()=>{if(!cancelled)setError('Không đọc được ảnh. Hãy thử chọn ảnh khác.')};img.src=source
    return()=>{cancelled=true}
  },[source])
  async function apply(){if(saving)return;setSaving(true);setError('');try{
    if(!image.current||!rect)return
    const canvas=document.createElement('canvas');canvas.width=kind==='avatar'?400:1200;canvas.height=Math.round(canvas.width/ratio)
    const context=canvas.getContext('2d');if(!context)throw Error('canvas')
    context.fillStyle='#f1e7d9';context.fillRect(0,0,canvas.width,canvas.height)
    context.drawImage(image.current,rect.left,rect.top,rect.width,rect.height,0,0,canvas.width,canvas.height)
    await onApply(canvas.toDataURL('image/jpeg',.85),settings);dialog.current?.close()
  }catch(error){setError(error instanceof Error?error.message:'Không lưu được ảnh. Hãy thử lại.')}finally{setSaving(false)}}
  function start(event:React.PointerEvent<HTMLElement>,mode:'move'|'resize'){
    if(!loaded||saving)return
    event.preventDefault();event.stopPropagation();event.currentTarget.focus({preventScroll:true})
    drag.current={x:event.clientX,y:event.clientY,mode,settings};event.currentTarget.setPointerCapture(event.pointerId)
  }
  function move(event:React.PointerEvent<HTMLElement>){
    const previous=drag.current,bounds=stage.current?.getBoundingClientRect();if(!previous||!bounds)return
    const dx=(event.clientX-previous.x)*size.width/bounds.width,dy=(event.clientY-previous.y)*size.height/bounds.height
    const original=cropRect(size.width,size.height,previous.settings)
    if(previous.mode==='resize')setSettings(resizeCrop(size.width,size.height,previous.settings,original.width+(dx+dy*ratio)/2))
    else setSettings({...previous.settings,x:original.width<size.width?Math.max(-1,Math.min(1,previous.settings.x-2*dx/(size.width-original.width))):0,y:original.height<size.height?Math.max(-1,Math.min(1,previous.settings.y-2*dy/(size.height-original.height))):0})
  }
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="cover-edit-heading" onClose={onClose} onCancel={event=>{if(saving)event.preventDefault()}}>
    <header><h2 id="cover-edit-heading">Chỉnh sửa {label}</h2><button type="button" disabled={saving} aria-label="Đóng chỉnh sửa ảnh" onClick={()=>dialog.current?.close()}><X size={20}/></button></header>
    <div className={styles.workspace}>
      <div ref={stage} className={styles.stage} style={loaded?{aspectRatio:size.width/size.height,width:`min(100%, ${size.width/size.height*46}dvh)`}:undefined}>
        {loaded&&<><NextImage src={source} alt="" width={size.width} height={size.height} unoptimized draggable={false}/><div className={styles.selection} data-round={kind==='avatar'} style={{left:`${rect!.left/size.width*100}%`,top:`${rect!.top/size.height*100}%`,width:`${rect!.width/size.width*100}%`,height:`${rect!.height/size.height*100}%`}} tabIndex={0} role="group" aria-label={`Khung cắt ${label}, dùng phím mũi tên để di chuyển`} onPointerDown={event=>start(event,'move')} onPointerMove={move} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}} onLostPointerCapture={()=>{drag.current=null}} onKeyDown={event=>{
          if(event.target!==event.currentTarget||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return
          event.preventDefault();setSettings(current=>({...current,x:Math.max(-1,Math.min(1,current.x+(event.key==='ArrowLeft'?.04:event.key==='ArrowRight'?-.04:0))),y:Math.max(-1,Math.min(1,current.y+(event.key==='ArrowUp'?.04:event.key==='ArrowDown'?-.04:0)))}))
        }}><span className={styles.grid} aria-hidden="true"/><button type="button" className={styles.handle} role="slider" aria-label={`Kích thước khung cắt ${label}`} aria-valuemin={100} aria-valuemax={300} aria-valuenow={Math.round(settings.zoom*100)} aria-valuetext={`Phóng to ${Math.round(settings.zoom*100)}%`} onPointerDown={event=>start(event,'resize')} onPointerMove={move} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}} onLostPointerCapture={()=>{drag.current=null}} onKeyDown={event=>{
          if(!['ArrowLeft','ArrowDown','ArrowRight','ArrowUp','Home','End'].includes(event.key))return
          event.preventDefault();event.stopPropagation();setSettings(current=>({...current,zoom:event.key==='Home'?1:event.key==='End'?3:Math.max(1,Math.min(3,current.zoom+(['ArrowRight','ArrowUp'].includes(event.key)?.05:-.05)))}))
        }}/></div></>}
        {!loaded&&<span className={styles.loading} role="status">Đang mở ảnh…</span>}
      </div>
    </div>
    <div className={styles.instructions}><p>Kéo khung để chọn vùng ảnh. Kéo nút tròn để chỉnh kích thước.</p><button type="button" disabled={!loaded||saving} onClick={()=>setSettings({...defaultCrop,ratio})}>Đặt lại</button></div>
    {error&&<p className={styles.error} role="alert">{error}</p>}<footer><button type="button" disabled={saving} onClick={()=>dialog.current?.close()}>Hủy</button><button className={styles.primary} type="button" disabled={!loaded||saving} onClick={apply}><Check size={16}/>{saving?'Đang lưu…':`Lưu ${label}`}</button></footer>
  </dialog>
}

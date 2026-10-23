'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './post-actions.module.css'

export function UnsavedChanges({ dirty, onSave }: { dirty:boolean; onSave:()=>Promise<boolean> }) {
  const router=useRouter()
  const dialog=useRef<HTMLDialogElement>(null)
  const pending=useRef<null|(()=>void)>(null)
  const latest=useRef({dirty,onSave})
  useLayoutEffect(()=>{latest.current={dirty,onSave}},[dirty,onSave])
  const bypass=useRef(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  useEffect(()=>{
    bypass.current=false
    const address=location.pathname+location.search
    if(history.state?.__demoEditorGuard!==address)history.pushState({...history.state,__demoEditorGuard:address},'',location.href)
    function ask(leave:()=>void){if(dialog.current?.open)return;pending.current=leave;setError('');dialog.current?.showModal()}
    function click(event:MouseEvent){
      if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||!latest.current.dirty||bypass.current)return
      const anchor=(event.target as Element)?.closest?.('a[href]') as HTMLAnchorElement|null
      if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download'))return
      const url=new URL(anchor.href,location.href)
      if(url.origin===location.origin&&url.pathname===location.pathname&&url.search===location.search)return
      if(!['http:','https:'].includes(url.protocol))return
      event.preventDefault();event.stopPropagation()
      ask(()=>url.origin===location.origin?router.push(url.pathname+url.search+url.hash):location.assign(url.href))
    }
    function pop(event:PopStateEvent){
      if(bypass.current||location.pathname+location.search!==address||event.state?.__demoEditorGuard===address)return
      event.stopImmediatePropagation()
      if(!latest.current.dirty){bypass.current=true;history.back();return}
      history.pushState({...history.state,__demoEditorGuard:address},'',location.href)
      ask(()=>history.go(-2))
    }
    function unload(event:BeforeUnloadEvent){if(latest.current.dirty&&!bypass.current){event.preventDefault();event.returnValue=''}}
    document.addEventListener('click',click,true);window.addEventListener('popstate',pop,true);window.addEventListener('beforeunload',unload)
    return()=>{document.removeEventListener('click',click,true);window.removeEventListener('popstate',pop,true);window.removeEventListener('beforeunload',unload)}
  },[router])
  function leave(){const action=pending.current;pending.current=null;bypass.current=true;dialog.current?.close();action?.()}
  async function save(){setBusy(true);setError('');try{if(await latest.current.onSave())leave();else setError('Chưa lưu được bản nháp. Hãy thử lại hoặc chọn Không lưu.')}catch{setError('Không thể lưu bản nháp. Hãy thử lại.')}finally{setBusy(false)}}
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="unsaved-heading" onCancel={event=>{if(busy)event.preventDefault()}} onClose={()=>{if(dialog.current?.open)return;pending.current=null;setError('')}}>
    <span className={styles.eyebrow}>BẠN CÒN THAY ĐỔI CHƯA LƯU</span><h2 id="unsaved-heading">Lưu bản nháp trước khi rời đi?</h2><p>Nội dung vừa chỉnh sửa chưa được lưu. Bạn muốn giữ lại để tiếp tục viết sau chứ?</p>{error&&<p role="alert">{error}</p>}<div className={styles.buttons}><button autoFocus disabled={busy} onClick={()=>dialog.current?.close()}>Hủy</button><button disabled={busy} onClick={leave}>Không lưu</button><button className={styles.primary} disabled={busy} onClick={save}>{busy?'Đang lưu…':'Lưu nháp'}</button></div>
  </dialog>
}

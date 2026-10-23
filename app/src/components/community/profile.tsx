'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, BookOpen, Check, ChefHat, FileText, MapPin, Pencil, Search, X } from 'lucide-react'
import { CoverEditor } from '@/components/cover-editor'
import { PhotoMenu } from '@/components/photo-menu'
import { PostActions } from './post-actions'
import type { ProfileImageEdits } from '@/lib/image-crop'
import { FollowAuthor } from './follow-author'
import { CommunityFrame } from './frame'
import { CreatePost } from './create-post'
import { PaginatedPosts } from './paginated-posts'
import { FoodArt } from '@/components/food-art'
import { FadeImage } from '@/components/fade-image'
import { ChefLoader } from '@/components/chef-loader'
import { AuthToast } from '@/components/auth-toast'
import { useStableResults } from '@/components/use-stable-results'
import type { SessionUser, PostSummary, PostList } from './types'
import shell from './shell.module.css'
import styles from './profile.module.css'
type FormProfile = { name:string; username:string; title:string; bio:string; location:string; avatar:string; cover:string; coverY:number; coverMediaId:string|null; avatarMediaId:string|null; imageEdits?:ProfileImageEdits }
type ProfileData = {
  own:boolean; profile:{id:string;username:string;displayName:string;titleName:string;bio:string;location:string;avatarUrl:string|null;coverUrl:string|null;coverMediaId:string|null;avatarMediaId:string|null;coverY:number;imageEdits?:ProfileImageEdits};
  stats:{publishedCount:number;draftCount:number|null;followerCount:number;followingCount:number};
  items:(Omit<PostSummary,'publishedAt'> & {publishedAt:string|null;updatedAt:string})[];pagination:PostList['pagination'];
}
const blank:FormProfile = {name:'',username:'',title:'',bio:'',location:'',avatar:'',cover:'',coverY:50,coverMediaId:null,avatarMediaId:null}
async function api(url:string,init?:RequestInit) {
  const response = await fetch(url,{cache:'no-store',...init})
  const data = await response.json()
  if (!response.ok) throw new Error(response.status===401?'Phiên đăng nhập đã hết. Hãy đăng nhập lại.':response.status===404?'Không tìm thấy trang cá nhân.':response.status===403?'Bạn không có quyền xem nội dung này.':'Không thể hoàn tất. Kiểm tra dữ liệu và thử lại.')
  return data
}
export function ProfilePage({ username, viewer }: {username:string;viewer:SessionUser|null}) {
  const router = useRouter()
  const [data,setData] = useState<ProfileData|null>(null)
  const [tab,setTab] = useState<'posts'|'drafts'>('posts')
  const [loadedTab,setLoadedTab] = useState<'posts'|'drafts'>('posts')
  const [page,setPage] = useState(1)
  const [query,setQuery] = useState('')
  const [pending,setPending] = useState(true)
  const { region: resultsRegion, content: resultsContent, capture: captureResults } = useStableResults(pending, tab)
  function selectTab(next: 'posts'|'drafts') {
    if (next === tab) return
    captureResults(); setPending(true); setTab(next); setPage(1)
  }
  const [error,setError] = useState('')
  const [reload,setReload] = useState(0)
  const [notice,setNotice] = useState('')
  const [busy,setBusy] = useState(false)
  const operation = useRef(false)
  const [cropping,setCropping]=useState<{kind:'cover'|'avatar';source:string;ratio:number;file?:File}|null>(null)
  const coverFrame=useRef<HTMLDivElement>(null)
  const [editing,setEditing] = useState(false)
  const [closing,setClosing] = useState(false)
  const [formError,setFormError] = useState('')
  const [form,setForm] = useState(blank)
  const dialog = useRef<HTMLDialogElement>(null)
  const main = useRef<HTMLElement>(null)
  const own = data?.own ?? false
  const profile:FormProfile = data ? {name:data.profile.displayName,username:data.profile.username,title:data.profile.titleName,bio:data.profile.bio,location:data.profile.location,avatar:data.profile.avatarUrl||'',cover:data.profile.coverUrl||'',coverY:data.profile.coverY,coverMediaId:data.profile.coverMediaId,avatarMediaId:data.profile.avatarMediaId,imageEdits:data.profile.imageEdits} : blank
  const effectiveViewer = viewer && own ? {...viewer,displayName:profile.name,avatarUrl:profile.avatar||null} : viewer
  const postResult = useMemo<PostList|null>(()=>data && tab==='posts' ? {posts:data.items.flatMap(item=>item.publishedAt?[{...item,publishedAt:item.publishedAt}]:[]),pagination:data.pagination,popularTags:[],selectedTag:null}:null,[data,tab])
  useEffect(()=>{
    const controller = new AbortController()
    const timer=setTimeout(async()=>{
      setPending(true);setError('')
      try { const result:ProfileData=await api(`/api/profiles/${username}?${new URLSearchParams({tab,page:String(page),q:query})}`,{signal:controller.signal});if(!controller.signal.aborted){setData(result);setLoadedTab(tab)} }
      catch(error){if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Không tải được hồ sơ.')}
      finally {if(!controller.signal.aborted)setPending(false)}
    },150)
    return()=>{clearTimeout(timer);controller.abort()}
  },[username,tab,page,query,reload])
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),5000);return()=>clearTimeout(timer)},[notice])
  useEffect(() => {
    function sync(event: Event) {
      const detail = (event as CustomEvent<{ username:string;status:{followerCount:number;followingCount:number} }>).detail
      if (detail.username.toLowerCase() === username.toLowerCase()) { setData(current => current ? { ...current, stats:{ ...current.stats, followerCount:detail.status.followerCount, followingCount:detail.status.followingCount } } : current); setReload(value => value + 1) }
      else if (own) setReload(value => value + 1)
    }
    window.addEventListener('follow-changed', sync)
    return () => window.removeEventListener('follow-changed', sync)
  }, [username, own])
  async function saveProfile(value:FormProfile) {
    await api('/api/profile',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:value.name,bio:value.bio,location:value.location,coverMediaId:value.coverMediaId,avatarMediaId:value.avatarMediaId,coverY:value.coverY,imageEdits:value.imageEdits})})
    setData(current=>current?{...current,profile:{...current.profile,displayName:value.name,bio:value.bio,location:value.location,coverMediaId:value.coverMediaId,avatarMediaId:value.avatarMediaId,coverUrl:value.cover||null,avatarUrl:value.avatar||null,coverY:value.coverY,imageEdits:value.imageEdits}}:current)
    setReload(value=>value+1);router.refresh()
  }
  function openCrop(kind:'cover'|'avatar',file?:File){
    const rect=coverFrame.current?.getBoundingClientRect(),original=profile.imageEdits?.[kind]?.originalId
    setCropping({kind,file,source:file?URL.createObjectURL(file):original?`/api/media/${original}/file`:kind==='cover'?profile.cover:profile.avatar,ratio:kind==='avatar'?1:rect?rect.width/rect.height:3})
  }
  useEffect(()=>{const source=cropping?.source;return()=>{if(source?.startsWith('blob:'))URL.revokeObjectURL(source)}},[cropping?.source])
  function upload(file:File|undefined,avatar=false){
    if(!file||operation.current)return
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){setNotice('Chọn ảnh JPEG, PNG, WebP tối đa 5 MiB.');return}
    openCrop(avatar?'avatar':'cover',file)
  }
  async function uploadMedia(file:File){const body=new FormData();body.set('file',file);const {media}=await api('/api/media/upload',{method:'POST',body});return media.id as string}
  function openEdit(){setFormError('');setForm(profile);setEditing(true);setClosing(false);dialog.current?.showModal()}
  function closeEdit(){if(!operation.current)setClosing(true)}
  function selectTag(tag:string){router.push(`/home?tag=${encodeURIComponent(tag)}`)}
  if(!data)return <CommunityFrame user={viewer}><main className={shell.feed}><Link href="/home">← Về trang chủ</Link>{error ? <p role="alert">{error}</p> : <ChefLoader />}{error&&<button onClick={()=>setReload(value=>value+1)}>Thử lại</button>}</main></CommunityFrame>
  return <CommunityFrame user={effectiveViewer} className={styles.page} rightPanel={<div className={styles.sideCard}><span className={styles.eyebrow}>CĂN BẾP NÀY CÓ</span><div><strong>{data.stats.publishedCount}</strong><span>bài đã xuất bản</span></div>{own&&<div><strong>{data.stats.draftCount}</strong><span>bản nháp của bạn</span></div>}<p>Một điều nhỏ bạn chia sẻ có thể làm bữa ăn của ai đó vui hơn.</p></div>}>
      <main ref={main} className={`${shell.feed} ${styles.feed}`}>
    {error&&<p className={styles.formError} role="alert">{error}<button onClick={()=>setReload(value=>value+1)}>Thử lại</button></p>}
        <Link className={styles.back} href="/home"><ArrowLeft size={14} />Trở về căn bếp</Link>
        <section className={styles.profile} aria-label="Hồ sơ tác giả" aria-busy={busy}>
          <div ref={coverFrame} className={styles.cover}>
            {profile.cover ? <FadeImage src={profile.cover} alt={`Ảnh bìa của ${profile.name}`} style={{ objectPosition: `center ${profile.coverY}%` }} /> : <div className={styles.coverArt}><div><span>MỖI CĂN BẾP, MỘT CÂU CHUYỆN</span><p>Một góc nhỏ,<br /><em>nhiều bữa ngon.</em></p></div><FoodArt kind={1} /></div>}
            {own&&<div className={styles.coverActions}><PhotoMenu kind="cover" canEdit={!!profile.cover} disabled={busy} className={styles.coverCamera} onEdit={()=>openCrop('cover')} onUpload={file=>upload(file)}/></div>}
          </div>
          <div className={styles.identity}>
            <div className={styles.portrait}><div className={styles.avatar}>{profile.avatar?<FadeImage src={profile.avatar} alt={`Ảnh đại diện của ${profile.name}`}/>:<span>{profile.name.slice(0,1).toUpperCase()}</span>}{own&&<PhotoMenu kind="avatar" canEdit={!!profile.avatar} disabled={busy} className={styles.avatarUpload} onEdit={()=>openCrop('avatar')} onUpload={file=>upload(file,true)}/>}</div><span className={styles.rank}><ChefHat size={12}/>{profile.title}</span></div>
            <div className={styles.name}><h1>{profile.name}</h1><span className={styles.username}>@{profile.username}</span></div>
            <div className={styles.actions}><FollowAuthor key={viewer?.id ?? 'guest'} username={username} />{own ? <button className={styles.secondary} disabled={busy} onClick={openEdit}><Pencil size={14} />Sửa hồ sơ</button> : null}</div>
          </div>
          <div className={styles.about}><p>{profile.bio || 'Câu chuyện từ căn bếp này đang được viết tiếp.'}</p><div className={styles.socialStats} aria-label="Thống kê theo dõi" aria-live="polite"><div><strong>{data.stats.followerCount.toLocaleString('vi-VN')}</strong>{' '}<span>người theo dõi</span></div><div><strong>{data.stats.followingCount.toLocaleString('vi-VN')}</strong>{' '}<span>đang theo dõi</span></div></div><div className={styles.details}>{profile.location && <span><MapPin size={13} />{profile.location}</span>}{own && <span><strong>{data!.stats.draftCount ?? 0}</strong> bản nháp</span>}</div></div>
        </section>
        <div className={styles.contentHeader}><nav className={styles.tabs} aria-label="Nội dung trang cá nhân" data-tab={tab} data-single={!own}><span className={styles.tabMarker} aria-hidden="true" /><button aria-pressed={tab === 'posts'} onClick={() => selectTab('posts')}><BookOpen size={15} />Bài viết<small>{data!.stats.publishedCount}</small></button>{own && <button aria-pressed={tab === 'drafts'} onClick={() => selectTab('drafts')}><FileText size={15} />Bản nháp<small>{data!.stats.draftCount ?? 0}</small></button>}</nav>{own && <CreatePost />}</div>
        <section className={styles.tabContent} aria-label={tab === 'posts' ? 'Bài viết đã xuất bản' : 'Bản nháp'}>
          <label className={styles.filter}><Search size={16} /><input value={query} maxLength={100} onChange={event => { setPage(1); setQuery(event.target.value) }} aria-label="Tìm bài viết của tác giả" placeholder="Tìm trong căn bếp này…" />{query && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => { setPage(1); setQuery('') }}><X size={14} /></button>}</label>
          <div ref={resultsRegion} className={styles.results} aria-busy={pending}><div ref={resultsContent}>
          {loadedTab !== tab ? <ChefLoader mode="section" /> : tab === 'posts' ? <PaginatedPosts result={postResult} pending={pending} filterKey={`${username}:${query}`} onPage={setPage} onTag={selectTag} renderActions={own?post=><PostActions id={post.id} title={post.title} onDone={()=>setReload(value=>value+1)}/>:undefined} /> : <>
            <div className={styles.drafts}>{data!.items.map(draft => <article className={styles.draft} key={draft.id}>
              <div className={styles.draftArt}>{draft.coverUrl ? <FadeImage src={draft.coverUrl} alt="" /> : <FoodArt kind={1} />}<span>BẢN NHÁP</span></div>
              <div className={styles.draftTools}><PostActions id={draft.id} title={draft.title} published={false} onDone={()=>setReload(value=>value+1)}/></div><div className={styles.draftBody}><small>{draft.type === 'recipe' ? 'Công thức' : 'Chuyện trong bếp'}</small><h2>{draft.title}</h2><p>{draft.excerpt}</p><div className={styles.draftTags}>{draft.tags.map(tag => <span key={tag.id}>#{tag.name}</span>)}</div><Link className={styles.primary} href={`/editor/${draft.id}`}><Pencil size={14} />Tiếp tục viết<ArrowUpRight size={14} /></Link></div>
            </article>)}</div>
            {data!.pagination.totalPages > 1 && <nav className={styles.draftPages} aria-label="Phân trang bản nháp"><button disabled={pending || page <= 1} onClick={() => setPage(page - 1)}>Trang trước</button><span>{data!.pagination.page} / {data!.pagination.totalPages}</span><button disabled={pending || !data!.pagination.hasNext} onClick={() => setPage(page + 1)}>Trang sau</button></nav>}
          </>}
          {loadedTab === tab && !pending && !data!.items.length && <div className={shell.empty}><FileText size={30} /><h2>{query ? 'Chưa có bài phù hợp' : tab === 'drafts' ? 'Một câu chuyện đang chờ bạn' : 'Căn bếp đang chờ món đầu tiên'}</h2><p>{query ? 'Thử từ khóa khác trong căn bếp này.' : tab === 'drafts' ? 'Bản nháp bạn tạo sẽ được lưu ở đây.' : 'Những bài đã xuất bản sẽ xuất hiện tại đây.'}</p>{own && <CreatePost />}</div>}

          </div></div>
        </section>

      </main>
    <dialog ref={dialog} className={styles.dialog} data-closing={closing} onCancel={event => { event.preventDefault(); closeEdit() }} onClose={() => { setEditing(false); setClosing(false) }} onAnimationEnd={event => { if (closing && event.target === event.currentTarget) dialog.current?.close() }}>
      <button type="button" className={styles.close} aria-label="Đóng sửa hồ sơ" onClick={closeEdit}><X size={20} /></button>
      {editing && <form inert={busy} onSubmit={async event => { event.preventDefault(); if (operation.current) return; if (!form.name.trim()) { setFormError('Nhập tên hiển thị của bạn.'); return } operation.current = true; setBusy(true); try { await saveProfile({ ...form, name: form.name.trim(), bio: form.bio.trim(), location: form.location.trim() }); setClosing(true); setNotice('Đã lưu hồ sơ trên máy chủ.') } catch (error) { setFormError(error instanceof Error ? error.message : 'Không lưu được hồ sơ.') } finally { operation.current = false; setBusy(false) } }}><span className={styles.eyebrow}>MỘT CHÚT VỀ BẠN</span><h2>Để căn bếp có dấu ấn riêng.</h2><label>Tên hiển thị<input required maxLength={80} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label><label>Giới thiệu<textarea rows={4} maxLength={240} value={form.bio} onChange={event => setForm({ ...form, bio: event.target.value })} /><small>{form.bio.length}/240</small></label><label>Nơi ở<input maxLength={80} value={form.location} onChange={event => setForm({ ...form, location: event.target.value })} /></label>{formError && <p className={styles.formError} role="alert">{formError}</p>}<button className={styles.primary} type="submit"><Check size={15} />Lưu hồ sơ</button></form>}
    </dialog>
    {own&&cropping&&<CoverEditor source={cropping.source} kind={cropping.kind} ratio={cropping.ratio} initial={cropping.file?undefined:profile.imageEdits?.[cropping.kind]?.settings} onClose={()=>setCropping(null)} onApply={async(image,settings)=>{
      if(operation.current)throw new Error('Đang xử lý ảnh. Hãy thử lại.')
      operation.current=true;setBusy(true)
      try{
        const originalId=cropping.file?await uploadMedia(cropping.file):profile.imageEdits?.[cropping.kind]?.originalId||(cropping.kind==='cover'?profile.coverMediaId:profile.avatarMediaId)
        if(!originalId)throw new Error('Không tìm thấy ảnh gốc.')
        const blob=await (await fetch(image)).blob(),id=await uploadMedia(new File([blob],`${cropping.kind}.jpg`,{type:'image/jpeg'})),url=`/api/media/${id}/file`
        await saveProfile({...profile,...(cropping.kind==='cover'?{cover:url,coverMediaId:id,coverY:50}:{avatar:url,avatarMediaId:id}),imageEdits:{...profile.imageEdits,[cropping.kind]:{originalId,settings}}})
        setNotice('Đã lưu ảnh đã chỉnh sửa trên máy chủ.')
      }finally{operation.current=false;setBusy(false)}
    }}/>}
    <AuthToast message={notice} />
  </CommunityFrame>
}

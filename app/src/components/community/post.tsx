'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Bookmark, ChefHat, Clock3, Share2, Users } from 'lucide-react'
import { ChefLoader } from '@/components/chef-loader'
import { CommunityFrame } from './frame'
import type { PostDetail, SessionUser } from './types'
import shell from './shell.module.css'
import { groupImages } from '@/lib/posts/image-groups'
import { VideoPlayer } from '@/components/video-player'
import { ImageGroup } from '@/components/image-group'
import { ListContent } from '@/components/list-content'
import styles from './reader.module.css'
import extra from './integration.module.css'

function youtubeEmbed(source: string) {
  try {
    const url = new URL(source)
    if (!['www.youtube.com', 'youtube.com'].includes(url.hostname)) return null
    const id = url.searchParams.get('v')
    return id && /^[\w-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null
  } catch { return null }
}
export function CommunityPost({ id, user }: { id: string; user: SessionUser | null }) {
  const [post, setPost] = useState<PostDetail | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    async function read() {
      try {
        const response = await fetch(`/api/posts/${id}`, { signal: controller.signal, cache: 'no-store' })
        if (!response.ok) throw new Error(response.status === 404 ? 'Bài viết không tồn tại hoặc chưa được xuất bản.' : 'Không tải được bài viết. Vui lòng thử lại.')
        const data: { post: PostDetail } = await response.json()
        if (!controller.signal.aborted) { setPost(data.post); setError('') }
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Không kết nối được máy chủ.') }
    }
    void read()
    return () => controller.abort()
  }, [id, retry])
  async function share() {
    try { await navigator.clipboard.writeText(location.href); setNotice('Đã sao chép liên kết bài viết.') }
    catch { setNotice('Bạn có thể sao chép địa chỉ trên thanh trình duyệt để chia sẻ.') }
  }
  const mediaById = new Map(post?.media.map(media => [media.id, media]))
  const cover = post?.media.find(media => media.id === post.coverMediaId)
  return <CommunityFrame user={user}>
    <main className={`${shell.feed} ${styles.reader}`}>
      {error ? <div className={shell.empty} role="alert"><h1>Chưa thể mở bài viết</h1><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>Thử lại</button><p><Link href="/home">Trở về căn bếp</Link></p></div> : !post ? <ChefLoader /> : <article className={styles.article}>
        <Link href="/home" className={styles.back}><ArrowLeft size={14} />Trở về căn bếp</Link>
        <div className={styles.topline}><div className={styles.tags}>{post.tags.map(tag => <Link key={tag.id} href={`/home?tag=${encodeURIComponent(tag.slug)}`}>{tag.name}</Link>)}</div>{post.recipe && <div className={extra.facts}><span><Clock3 size={14} />Chuẩn bị: {post.recipe.prepMinutes ?? '—'} phút</span><span><Clock3 size={14} />Chế biến: {post.recipe.cookMinutes ?? '—'} phút</span><span><Users size={14} />{post.recipe.servings ?? '—'} người</span><span><ChefHat size={14} />Độ khó: {post.recipe.difficulty ?? '—'}/5</span></div>}</div>
        <h1>{post.title}</h1><p className={styles.lead}>{post.excerpt}</p>
        <div className={styles.byline}><span className={styles.smallAvatar}>{post.author.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{post.author.displayName}</strong><small>{post.author.titleName}</small></div><time dateTime={post.publishedAt}>{new Date(post.publishedAt).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</time></div>
        <div className={styles.actions}><span>{post.type === 'recipe' ? 'Công thức từ cộng đồng' : 'Chuyện trong bếp'}</span><button disabled title="Chức năng lưu bài chưa sẵn sàng"><Bookmark size={16} />Lưu bài viết</button><button onClick={share}><Share2 size={16} />Chia sẻ</button></div>
        {notice && <p role="status">{notice}</p>}
        {cover?.url && <figure className={styles.hero}><div className={extra.hero}><Image src={cover.url} alt={post.title} width={1200} height={600} unoptimized priority /></div></figure>}
        {post.recipe && <section className={styles.ingredients}><div className={styles.sectionHeading}><span>01</span><h2>Chuẩn bị nguyên liệu</h2></div><p>Cho {post.recipe.servings ?? '—'} người · Đánh dấu những nguyên liệu bạn đã có.</p><div className={styles.ingredientList}>{post.recipe.ingredients.map((ingredient, index) => <label key={`${ingredient.position}:${index}`}><input type="checkbox" /><span>{ingredient.name} — {[ingredient.quantity, ingredient.unit].filter(Boolean).join(' ')}{ingredient.note && <small> · {ingredient.note}</small>}</span></label>)}</div></section>}
        <div className={extra.blocks}>{groupImages(post.blocks, block => block.data.type === 'image' && Boolean(mediaById.get(block.data.mediaId)?.url)).map(group => {
          if (group.kind === 'images') return <ImageGroup key={group.items[0].position} images={group.items.flatMap(({ data, position }) => {
            if (data.type !== 'image') return []
            const media = mediaById.get(data.mediaId)
            return media?.url ? [{ id: String(position), src: media.url, alt: data.alt, caption: data.caption }] : []
          })} />
          const block = group.block
          const data = block.data
          const key = block.position
          if (data.type === 'heading') { const Heading = `h${data.level}` as 'h1' | 'h2' | 'h3'; return <Heading key={key}>{data.text}</Heading> }
          if (data.type === 'list') return <ListContent key={key} data={data} />
          if (data.type === 'paragraph') return <p key={key}>{data.text}</p>
          const media = post.media.find(item => item.id === data.mediaId)
          if (!media?.url) return <p key={key} className={extra.unavailable}>Nội dung đa phương tiện không còn khả dụng.</p>
          if (data.type === 'image') return <figure key={key}><Image src={media.url} alt={data.alt} width={1200} height={800} unoptimized />{data.caption && <figcaption>{data.caption}</figcaption>}</figure>
          const embed = media.source === 'url' ? youtubeEmbed(media.url) : null
          return <figure key={key}><VideoPlayer src={embed || media.url} youtube={Boolean(embed)} title={data.caption || 'Video hướng dẫn'} />{data.caption && <figcaption>{data.caption}</figcaption>}</figure>
        })}</div>
      </article>}
    </main>
  </CommunityFrame>
}

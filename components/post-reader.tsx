'use client'

import { useRef, useState } from 'react'
import { AutoTextarea } from '@/components/auto-textarea'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, ArrowDown, ArrowUp, Bookmark, ChefHat, Check, Clock3, Eye, MessageCircle, Search, Send, Share2, Users, Utensils } from 'lucide-react'
import { categories, recipes } from '@/lib/recipes'
import { useSavedRecipes } from '@/lib/use-saved-recipes'
import { AccountMenu } from './account-menu'
import { CommunityNav } from './community-nav'
import { useFollowedAuthors } from '@/lib/use-followed-authors'
import { FoodArt } from './food-art'
import { InteractiveAmbient } from './interactive-ambient'
import shell from '@/app/home/page.module.css'
import styles from './post-reader.module.css'

type Recipe = typeof recipes[number]
type Comment = { id: number; author: string; text: string; role: string; replies: Comment[] }

function CommentThread({ comment, onReply }: { comment: Comment; onReply: (id: number, text: string) => void }) {
  const [vote, setVote] = useState(0)
  const [replying, setReplying] = useState(false)
  return <div className={styles.comment}>
    <div className={styles.commentAvatar}>{comment.author.slice(0, 1)}</div>
    <div className={styles.commentBody}><div className={styles.commentHeading}><strong>{comment.author}</strong><span>{comment.role}</span></div><p>{comment.text}</p>
      <div className={styles.commentActions}><button aria-label={`Thích bình luận của ${comment.author}`} aria-pressed={vote === 1} onClick={() => setVote(vote === 1 ? 0 : 1)}><ArrowUp size={14} /></button><span>{3 + vote}</span><button aria-label={`Không thích bình luận của ${comment.author}`} aria-pressed={vote === -1} onClick={() => setVote(vote === -1 ? 0 : -1)}><ArrowDown size={14} /></button><button onClick={() => setReplying(!replying)}><MessageCircle size={13} />Trả lời</button></div>
      {replying && <form className={styles.replyForm} onSubmit={event => { event.preventDefault(); const text = String(new FormData(event.currentTarget).get('reply') ?? '').trim(); if (text) { onReply(comment.id, text); setReplying(false) } }}><input name="reply" aria-label={`Trả lời ${comment.author}`} placeholder="Viết lời trả lời…" autoFocus required /><button type="submit" aria-label="Gửi trả lời"><Send size={15} /></button></form>}
      {comment.replies.length > 0 && <div className={styles.replies}>{comment.replies.map(reply => <CommentThread key={reply.id} comment={reply} onReply={onReply} />)}</div>}
    </div>
  </div>
}

export function PostReader({ recipe }: { recipe: Recipe }) {
  const [saved, toggleSave] = useSavedRecipes()
  const [followedAuthors, toggleFollow] = useFollowedAuthors()
  const following = followedAuthors.includes(recipe.author)
  const [notice, setNotice] = useState('')
  const nextComment = useRef(3)
  const [comments, setComments] = useState<Comment[]>([{ id: 1, author: 'Linh Nguyễn', text: 'Công thức dễ làm quá! Mình đã thử cho bữa sáng, cả nhà đều thích.', role: 'Đầu bếp kỳ cựu', replies: [{ id: 2, author: recipe.author, text: 'Cảm ơn bạn đã ghé bếp. Nhớ thưởng thức khi còn nóng nhé!', role: 'Tác giả', replies: [] }] }])
  const isSaved = saved.includes(recipe.id)
  const related = recipes.filter(item => item.id !== recipe.id).slice(0, 3)

  function addReply(id: number, text: string) {
    const reply: Comment = { id: nextComment.current++, author: 'Minh An', role: 'Bạn', text, replies: [] }
    const append = (items: Comment[]): Comment[] => items.map(item => item.id === id ? { ...item, replies: [...item.replies, reply] } : { ...item, replies: append(item.replies) })
    setComments(previous => append(previous))
  }

  async function share() {
    try { await navigator.clipboard.writeText(window.location.href); setNotice('Đã sao chép liên kết bài viết.') }
    catch { setNotice('Bạn có thể sao chép địa chỉ trên thanh trình duyệt để chia sẻ bài viết.') }
  }

  return <div className={shell.page}>
    <InteractiveAmbient className="ambient-one" /><InteractiveAmbient className="ambient-two" />
    <header className={shell.header}><Link className={shell.logo} href="/home"><Image src="/icons/logo.png" alt="" width={48} height={48} priority unoptimized /><span>RecipeShare<small>CLUB</small></span></Link><form action="/home" className={shell.search}><Search size={19} aria-hidden="true" /><input name="q" aria-label="Tìm món ăn" placeholder="Tìm một công thức bạn yêu thích…" /></form><div className={shell.account}><Link className={shell.createButton} href="/home">Khám phá món ngon</Link><AccountMenu /></div></header>
    <div className={shell.layout}>
      <aside className={`${shell.sidebar} ${styles.sidebar}`}><CommunityNav savedCount={saved.length} /><div className={styles.following}><p>GÓC BẾP QUEN THUỘC</p><button aria-pressed={following} onClick={() => toggleFollow(recipe.author)}><span className={styles.smallAvatar}>{recipe.author.slice(0, 1)}</span><span>{recipe.author}<small>{following ? 'Đang theo dõi' : 'Theo dõi tác giả'}</small></span></button></div><nav aria-label="Mục lục"><a href="#ingredients">Nguyên liệu</a><a href="#preparation">Sơ chế</a><a href="#steps">Cách làm</a><a href="#comments">Bình luận</a></nav><div className={shell.sidebarNote}><Utensils size={25} /><p>Nấu bằng cả<br />niềm yêu thích.</p><small>Một công thức, thêm một kỷ niệm.</small></div></aside>
      <main className={`${shell.feed} ${styles.reader}`}>
        <nav className={shell.categories} aria-label="Danh mục món ăn">{categories.map(category => <Link key={category} href={`/home?category=${encodeURIComponent(category)}`}>{category}</Link>)}</nav>
        <article className={styles.article}>
          <Link href="/home" className={styles.back}><ArrowLeft size={14} />Trở về căn bếp</Link>
          <div className={styles.topline}><div className={styles.tags}>{recipe.tags.map(tag => <Link key={tag} href={`/home?category=${encodeURIComponent(tag)}`}>{tag}</Link>)}</div><span><Clock3 size={14} />{recipe.minutes} phút · 2 phần ăn</span></div>
          <h1>{recipe.title}</h1><p className={styles.lead}>{recipe.description}</p>
          <div className={styles.byline}><span className={styles.smallAvatar}>{recipe.author.slice(0, 1)}</span><div><strong>{recipe.author}</strong><small>Đầu bếp yêu căn bếp của mình</small></div><time dateTime="2026-10-20">20.10.2026</time></div>
          <div className={styles.actions}><span><Eye size={15} />{recipe.views} lượt xem</span><button aria-pressed={isSaved} onClick={() => toggleSave(recipe.id)}><Bookmark size={16} fill={isSaved ? 'currentColor' : 'none'} />{isSaved ? 'Đã lưu công thức' : 'Lưu công thức'}</button><button onClick={share}><Share2 size={16} />Chia sẻ</button></div>
          <figure className={styles.hero}><FoodArt kind={recipe.id} /><figcaption>Một món ngon giản dị, một niềm vui nho nhỏ.</figcaption></figure>
          <section id="ingredients" className={styles.ingredients}><div className={styles.sectionHeading}><span>01</span><h2>Chuẩn bị nguyên liệu</h2></div><p>Cho 2 người · Đánh dấu những nguyên liệu bạn đã có.</p><div className={styles.ingredientList}>{recipe.ingredients.replace(/\.$/, '').split(', ').map(ingredient => <label key={ingredient}><input type="checkbox" /><span>{ingredient}</span><Check size={14} /></label>)}</div></section>
          <section id="preparation" className={styles.section}><div className={styles.sectionHeading}><span>02</span><h2>Một chút sơ chế</h2></div><p>Chuẩn bị sẵn các nguyên liệu, rửa sạch rau và để ráo. Chia gia vị vào từng chén nhỏ để việc nấu nướng nhẹ nhàng hơn. Bạn có thể điều chỉnh lượng gia vị theo khẩu vị của gia đình.</p><aside className={styles.tip}><ChefHat size={21} /><div><strong>Mách nhỏ từ căn bếp</strong><p>Chọn nguyên liệu tươi và chuẩn bị mọi thứ trước khi bật bếp. Một chút thong thả giúp món ăn ngon hơn.</p></div></aside></section>
          <section id="steps" className={styles.section}><div className={styles.sectionHeading}><span>03</span><h2>Cùng vào bếp thôi</h2></div><ol className={styles.steps}>{recipe.steps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>Bước {index + 1}</h3><p>{step}</p></div></li>)}</ol><div className={styles.finish}><FoodArt kind={recipe.id} /><div><small>THÀNH QUẢ TỪ CĂN BẾP</small><h3>Món ngon đã sẵn sàng.</h3><p>Dọn ra bàn và tận hưởng cùng những người bạn yêu thương.</p></div></div></section>
          <section id="comments" className={styles.section}><div className={styles.sectionHeading}><MessageCircle size={21} /><h2>Chuyện trò bên bếp</h2></div><p>Bạn đã thử công thức này chưa? Chia sẻ một chút nhé.</p><form className={styles.commentForm} onSubmit={event => { event.preventDefault(); const text = String(new FormData(event.currentTarget).get('comment') ?? '').trim(); if (!text) return; setComments(previous => [...previous, { id: nextComment.current++, author: 'Minh An', role: 'Bạn', text, replies: [] }]); event.currentTarget.reset(); setNotice('Đã thêm bình luận trong bản demo.') }}><AutoTextarea name="comment" aria-label="Bình luận của bạn" placeholder="Món ăn của bạn hôm nay thế nào?" rows={3} required /><button className={shell.createButton} type="submit">Gửi bình luận <Send size={14} /></button></form><div className={styles.comments}>{comments.map(comment => <CommentThread key={comment.id} comment={comment} onReply={addReply} />)}</div><small className={styles.localNote}>Bình luận dùng thử trong phiên này. Lựa chọn theo dõi được lưu trên trình duyệt.</small></section>
        </article>
      </main>
      <aside className={shell.rightPanel}><section className={styles.authorCard}><span className={styles.authorAvatar}>{recipe.author.slice(0, 1)}</span><p>NGƯỜI CHIA SẺ CÔNG THỨC</p><h2>{recipe.author}</h2><span className={styles.rank}>Đầu bếp truyền cảm hứng</span><p>Mang những bữa ăn giản dị và niềm vui vào bếp đến gần mọi người hơn.</p><span className={styles.followers}><Users size={14} />{following ? '1.201' : '1.200'} người theo dõi</span><button className={shell.createButton} aria-pressed={following} onClick={() => toggleFollow(recipe.author)}>{following ? <Check size={15} /> : <Users size={15} />}{following ? 'Đang theo dõi' : 'Theo dõi'}</button></section><section className={styles.popular}><h2>Thêm cảm hứng cho bạn</h2>{related.map(item => <Link href={`/posts/${item.id}`} key={item.id}><div><FoodArt kind={item.id} /></div><span><strong>{item.title}</strong><small>{item.minutes} phút · {item.views} lượt xem</small></span></Link>)}</section><div className={shell.community}><ChefHat size={36} /><h2>Bữa ngon bắt đầu từ một ý tưởng.</h2><p>Ghé trang chủ để tìm công thức tiếp theo cho căn bếp của bạn.</p><Link href="/home" className={styles.explore}>Khám phá công thức →</Link></div></aside>
    </div><p className={shell.status} role="status">{notice}</p>
  </div>
}

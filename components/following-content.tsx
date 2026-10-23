'use client'
import Link from 'next/link'
import { Users, Check } from 'lucide-react'
import { FoodArt } from './food-art'
import { useFollowedAuthors } from '@/lib/use-followed-authors'
import { demoAuthors, recipes } from '@/lib/recipes'
import shell from '@/app/home/page.module.css'
import styles from '@/app/following/page.module.css'

export function FollowingContent({ query, clearQuery }: { query: string; clearQuery: () => void }) {
  const [authors, toggle] = useFollowedAuthors()
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase()
  const matches = (value: string) => normalize(value).includes(normalize(query.trim()))
  const followed = recipes.filter(recipe => authors.includes(recipe.author) && matches(`${recipe.author} ${recipe.title}`))
  const suggestions = demoAuthors.filter(author => !authors.includes(author.author) && matches(author.author))
  return <>
        <div className={shell.welcome}><p>GÓC BẾP QUEN THUỘC</p><h1>Đang theo dõi</h1><span>Công thức từ những người bạn chọn đồng hành.</span></div>
        <div className={shell.feedHeading}><h2>Món mới từ căn bếp quen</h2><span>{authors.length} tác giả đang theo dõi</span></div>
        {followed.length ? <div className={styles.posts}>{followed.map(recipe => <article className={styles.post} key={recipe.id}>
          <Link href={`/posts/${recipe.id}`} className={styles.art}><FoodArt kind={recipe.id} /></Link>
          <div><small>{recipe.author}</small><Link href={`/posts/${recipe.id}`}><h2>{recipe.title}</h2></Link><p>{recipe.description}</p><span>{recipe.minutes} phút</span></div>
          <button onClick={() => toggle(recipe.author)} aria-label={`Bỏ theo dõi ${recipe.author}`}><Check size={15} />Đang theo dõi</button>
        </article>)}</div> : <div className={shell.empty}><Users size={32} /><h2>{query ? 'Chưa có kết quả phù hợp' : 'Cùng làm quen những căn bếp mới'}</h2><p>{query ? 'Thử tìm tên tác giả hoặc món ăn khác.' : 'Chọn theo dõi tác giả bên dưới. Công thức của họ sẽ xuất hiện tại đây.'}</p>{query && <button onClick={clearQuery}>Xóa tìm kiếm</button>}</div>}
        <section className={styles.discover}><h2>Khám phá người chia sẻ</h2><div className={styles.authors}>{suggestions.map(recipe => <article className={styles.author} key={recipe.id}><span className={styles.avatar}>{recipe.author.slice(0, 1)}</span><h3>{recipe.author}</h3><p>{recipe.recipeCount} công thức trong căn bếp</p><Link href={`/posts/${recipe.id}`}>Ghé xem công thức →</Link><button onClick={() => toggle(recipe.author)}><Users size={15} />Theo dõi</button></article>)}</div>{!suggestions.length && <p className={styles.hint}>{query ? 'Không có tác giả gợi ý phù hợp.' : 'Bạn đã theo dõi tất cả tác giả trong bản demo.'}</p>}</section>
  </>
}

import type { PostBlockData } from '@/db/schema'
import styles from './list-content.module.css'

export type ListBlockData = Extract<PostBlockData, { type: 'list' }>
export type ListStyle = ListBlockData['style']
export const listStyles: { value: ListStyle; label: string }[] = [
  { value: 'disc', label: '• Chấm tròn đặc' },
  { value: 'circle', label: '◦ Chấm tròn rỗng' },
  { value: 'square', label: '▪ Ô vuông' },
  { value: 'decimal', label: '1, 2, 3' },
  { value: 'lower-alpha', label: 'a, b, c' },
  { value: 'upper-alpha', label: 'A, B, C' },
  { value: 'lower-roman', label: 'i, ii, iii' },
  { value: 'upper-roman', label: 'I, II, III' },
]
export function listItems(text: string) {
  return text.split(/\r?\n/).map(item => item.trim()).filter(Boolean)
}
export function ListContent({ data }: { data: ListBlockData }) {
  if (!data.items.length) return null
  const List = ['disc', 'circle', 'square'].includes(data.style) ? 'ul' : 'ol'
  return <List className={styles.list} style={{ listStyleType: data.style }}>
    {data.items.map((item, index) => <li key={index}>{item}</li>)}
  </List>
}

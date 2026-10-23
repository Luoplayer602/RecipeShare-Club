import { ChefHat } from 'lucide-react'
import styles from './chef-loader.module.css'

export function ChefLoader({ mode = 'screen', label = 'Đang tải nội dung' }: { mode?: 'screen' | 'section' | 'inline'; label?: string }) {
  return <span className={`${styles.loader} ${styles[mode]}`} role="status" aria-label={label} data-chef-loader={mode}>
    <span className={styles.symbol} aria-hidden="true"><span className={styles.ring} /><ChefHat /></span>
  </span>
}

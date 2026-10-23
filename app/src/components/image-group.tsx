import { FadeImage } from './fade-image'
import styles from './image-group.module.css'

export type GroupImage = { id: string; src: string; alt: string; caption?: string }
export function ImageGroup({ images }: { images: GroupImage[] }) {
  return <div className={styles.group} data-count={images.length}>
    {images.map(image => <figure className={styles.item} key={image.id}>
      <FadeImage src={image.src} alt={image.alt} loading="lazy" />
      {image.caption && <figcaption>{image.caption}</figcaption>}
    </figure>)}
  </div>
}

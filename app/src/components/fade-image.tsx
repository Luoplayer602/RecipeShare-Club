'use client'
import { useState, type ImgHTMLAttributes } from 'react'
import styles from './fade-image.module.css'

export function FadeImage({ src, alt = '', className = '', onLoad, onError, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState<unknown>(null)
  // Uploaded media keeps its intrinsic aspect ratio without a resize service.
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} alt={alt} src={src} className={`${styles.image} ${className}`} data-loaded={loaded === src} onLoad={event => { setLoaded(src); onLoad?.(event) }} onError={event => { setLoaded(src); onError?.(event) }} />
}

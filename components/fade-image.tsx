'use client'
import { useState, type ImgHTMLAttributes } from 'react'
import styles from './fade-image.module.css'

export function FadeImage({ src, className = '', onLoad, onError, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState<unknown>(null)
  return <img {...props} src={src} className={`${styles.image} ${className}`} data-loaded={loaded === src} onLoad={event => { setLoaded(src); onLoad?.(event) }} onError={event => { setLoaded(src); onError?.(event) }} />
}

'use client'
import { useEffect, useRef, useState } from 'react'
import { activatePlayback, registerPlayback } from '@/lib/media/playback'
import { loadYouTubePlayer, type YouTubePlayer } from '@/lib/media/youtube-player'
import styles from './video-player.module.css'

export function VideoPlayer({ src, youtube = false, title = 'Video hướng dẫn', className = '' }: {
  src: string; youtube?: boolean; title?: string; className?: string;
}) {
  const container = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const titleRef = useRef(title)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    titleRef.current = title
    const frame = container.current?.querySelector('iframe')
    if (frame) frame.title = title
  }, [title])
  useEffect(() => {
    if (!youtube) {
      const element = video.current
      if (!element) return
      const playback = { pause: () => element.pause() }
      const unregister = registerPlayback(playback)
      const play = () => activatePlayback(playback)
      element.addEventListener('play', play)
      return () => { element.removeEventListener('play', play); element.pause(); unregister() }
    }
    const root = container.current
    if (!root) return
    let disposed = false, ready = false
    let player: YouTubePlayer | undefined
    const playback = { pause: () => { if (ready) player?.pauseVideo() } }
    const unregister = registerPlayback(playback)
    const mount = document.createElement('div')
    root.appendChild(mount)
    void loadYouTubePlayer().then(api => {
      if (disposed) return
      const id = new URL(src).pathname.split('/').pop() || ''
      player = new api.Player(mount, {
        host: 'https://www.youtube-nocookie.com', videoId: id, width: '100%', height: '100%',
        playerVars: { origin: window.location.origin, playsinline: 1 },
        events: {
          onReady: () => {
            if (disposed) return
            ready = true
            const frame = root.querySelector('iframe')
            if (frame) { frame.title = titleRef.current; frame.referrerPolicy = 'strict-origin-when-cross-origin' }
          },
          onStateChange: event => {
            if (!disposed && (event.data === 1 || event.data === 3)) activatePlayback(playback)
          },
        },
      })
    }).catch(() => { if (!disposed) setError(true) })
    return () => { disposed = true; unregister(); player?.destroy(); root.replaceChildren() }
  }, [src, youtube, retry])
  if (!youtube) return <video key={src} ref={video} className={className} src={src} controls playsInline preload="metadata" />
  return <div className={`${styles.player} ${className}`}>
    <div ref={container} className={styles.surface} />
    {error && <div className={styles.error} role="status"><span>Chưa tải được trình phát YouTube.</span><button type="button" onClick={() => { setError(false); setRetry(value => value + 1) }}>Thử lại</button></div>}
  </div>
}

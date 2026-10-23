export type YouTubePlayer = { pauseVideo: () => void; destroy: () => void }
type PlayerEvent = { target: YouTubePlayer; data: number }
type YouTubeApi = { Player: new (element: HTMLElement, options: {
  host: string; videoId: string; width: string; height: string;
  playerVars: { origin: string; playsinline: number };
  events: { onReady: (event: PlayerEvent) => void; onStateChange: (event: PlayerEvent) => void };
}) => YouTubePlayer }
declare global {
  interface Window { YT?: YouTubeApi; onYouTubeIframeAPIReady?: () => void }
}
let loading: Promise<YouTubeApi> | null = null
export function loadYouTubePlayer(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (loading) return loading
  loading = new Promise<YouTubeApi>((resolve, reject) => {
    const script = document.createElement('script')
    const previous = window.onYouTubeIframeAPIReady
    const timeout = window.setTimeout(fail, 20000)
    function cleanup() {
      clearTimeout(timeout)
      if (window.onYouTubeIframeAPIReady === ready) window.onYouTubeIframeAPIReady = previous
    }
    function fail() { cleanup(); script.remove(); loading = null; reject(new Error('YouTube API unavailable')) }
    function ready() {
      cleanup()
      if (window.YT?.Player) resolve(window.YT)
      else fail()
      previous?.()
    }
    window.onYouTubeIframeAPIReady = ready
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = fail
    document.head.appendChild(script)
  })
  return loading
}

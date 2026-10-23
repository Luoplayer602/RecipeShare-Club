export type NormalizedVideoUrl = {
  provider: 'youtube' | 'direct'
  url: string
}

const youtubeHosts = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
])

export function normalizeVideoUrl(
  value: string,
): NormalizedVideoUrl | null {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    return null
  }

  if (
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    (url.port !== '' && url.port !== '443')
  ) {
    return null
  }

  if (youtubeHosts.has(url.hostname)) {
    let videoId: string | null = null

    if (url.hostname === 'youtu.be') {
      videoId = url.pathname.match(/^\/([^/]+)\/?$/)?.[1] ?? null
    } else if (url.pathname === '/watch') {
      videoId = url.searchParams.get('v')
    } else {
      videoId = url.pathname.match(
        /^\/(?:shorts|embed)\/([^/]+)\/?$/,
      )?.[1] ?? null
    }

    if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return null
    }

    return {
      provider: 'youtube',
      url: `https://www.youtube.com/watch?v=${videoId}`,
    }
  }

  if (!/\.(mp4|webm)$/i.test(url.pathname)) {
    return null
  }

  return {
    provider: 'direct',
    url: url.toString(),
  }
}
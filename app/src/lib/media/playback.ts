export type Playback = { pause: () => void }
const players = new Set<Playback>()
export function registerPlayback(player: Playback) {
  players.add(player)
  return () => { players.delete(player) }
}
export function activatePlayback(active: Playback) {
  for (const player of players) if (player !== active) player.pause()
}
export function pauseAllPlayback() {
  for (const player of players) player.pause()
}

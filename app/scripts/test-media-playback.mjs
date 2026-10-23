import assert from 'node:assert/strict'
import { activatePlayback, pauseAllPlayback, registerPlayback } from '../src/lib/media/playback.ts'
const calls = []
const native = { pause: () => calls.push('native') }
const youtube = { pause: () => calls.push('youtube') }
const secondYouTube = { pause: () => calls.push('youtube2') }
const removeNative = registerPlayback(native)
const removeYouTube = registerPlayback(youtube)
const removeSecond = registerPlayback(secondYouTube)
activatePlayback(native)
assert.deepEqual(calls.splice(0), ['youtube', 'youtube2'])
activatePlayback(youtube)
assert.deepEqual(calls.splice(0), ['native', 'youtube2'])
activatePlayback(secondYouTube)
assert.deepEqual(calls.splice(0), ['native', 'youtube'])
pauseAllPlayback()
assert.deepEqual(calls.splice(0), ['native', 'youtube', 'youtube2'])
removeYouTube()
activatePlayback(native)
assert.deepEqual(calls.splice(0), ['youtube2'])
removeNative(); removeSecond()
pauseAllPlayback()
assert.deepEqual(calls, [])
console.log('PASS: exclusive playback across three players, pause-all on mode switch and unmount cleanup.')

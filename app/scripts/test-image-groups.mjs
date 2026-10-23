import assert from 'node:assert/strict'
import { groupImages } from '../src/lib/posts/image-groups.ts'
const image = block => block.type === 'image' && Boolean(block.src)
for (const [count, expected] of [[1,[1]], [2,[2]], [3,[3]], [4,[4]], [5,[3,2]], [6,[4,2]], [7,[4,3]], [8,[4,4]], [9,[4,3,2]]]) {
  const blocks = Array.from({ length: count }, (_, id) => ({ id, type: 'image', src: 'image' }))
  const groups = groupImages(blocks, image)
  assert.deepEqual(groups.map(group => group.items.length), expected)
  assert.deepEqual(groups.flatMap(group => group.items), blocks)
}
const blocks = [{ type:'image', src:'a' }, { type:'paragraph' }, { type:'image', src:'b' }, { type:'image', src:'' }, { type:'image', src:'c' }]
assert.deepEqual(groupImages(blocks, image).map(group => group.kind), ['images','block','images','block','images'])
assert.deepEqual(groupImages([], image), [])
console.log('PASS: image groups 1–9, original order, content boundaries and unavailable images.')

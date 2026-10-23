export type ImageGroup<T> = { kind: 'images'; items: T[] } | { kind: 'block'; block: T }

// Group only consecutive available images. Balance five remaining images as 3+2.
export function groupImages<T>(blocks: readonly T[], isImage: (block: T) => boolean): ImageGroup<T>[] {
  const groups: ImageGroup<T>[] = []
  let index = 0
  while (index < blocks.length) {
    if (!isImage(blocks[index])) { groups.push({ kind: 'block', block: blocks[index++] }); continue }
    const run: T[] = []
    while (index < blocks.length && isImage(blocks[index])) run.push(blocks[index++])
    for (let offset = 0; offset < run.length;) {
      const remaining = run.length - offset
      const size = remaining === 5 ? 3 : Math.min(4, remaining)
      groups.push({ kind: 'images', items: run.slice(offset, offset + size) })
      offset += size
    }
  }
  return groups
}

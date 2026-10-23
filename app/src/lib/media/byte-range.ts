export type ByteRange =
  | { kind: 'full' }
  | { kind: 'partial'; start: number; end: number }
  | { kind: 'invalid' }

export function parseByteRange(
  header: string | null,
  size: number,
): ByteRange {
  if (header === null) return { kind: 'full' }

  if (!Number.isSafeInteger(size) || size <= 0) {
    return { kind: 'invalid' }
  }

  // Support a single byte range.
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())

  if (!match || (!match[1] && !match[2])) {
    return { kind: 'invalid' }
  }

  if (!match[1]) {
    const suffixLength = Number(match[2])

    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return { kind: 'invalid' }
    }

    return {
      kind: 'partial',
      start: Math.max(0, size - suffixLength),
      end: size - 1,
    }
  }

  const start = Number(match[1])
  const requestedEnd = match[2] ? Number(match[2]) : size - 1

  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start >= size ||
    requestedEnd < start
  ) {
    return { kind: 'invalid' }
  }

  return {
    kind: 'partial',
    start,
    end: Math.min(requestedEnd, size - 1),
  }
}
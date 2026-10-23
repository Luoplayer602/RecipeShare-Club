'use client'
import { useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'

export function useSortableBlocks(ids: string[], reorder: (ids: string[]) => void) {
  const container = useRef<HTMLDivElement>(null)
  const before = useRef<Map<string, DOMRect> | null>(null)
  const animations = useRef<Animation[]>([])
  const session = useRef<(() => void) | null>(null)
  const pendingVideo = useRef<{ id: string; compactHeight: number } | null>(null)
  const latest = useRef({ ids, reorder })
  latest.current = { ids, reorder }
  const signature = ids.join(',')
  const nodes = () => Array.from(container.current?.querySelectorAll<HTMLElement>('[data-block-id]') ?? [])
  function contentRect(node: HTMLElement) {
    const rect = node.getBoundingClientRect()
    const scroll = container.current?.closest('main')?.scrollTop ?? 0
    return new DOMRect(rect.x, rect.y + scroll, rect.width, rect.height)
  }
  function capture() {
    before.current = new Map(nodes().map(node => [node.dataset.blockId!, contentRect(node)]))
    if (container.current) {
      const rect = container.current.getBoundingClientRect()
      before.current.set('__block_list__', rect)
      // Preserve occupied space before React removes a card, avoiding a scroll clamp.
      container.current.style.height = `${rect.height}px`
    }
  }
  function revealVideo(id: string, compactHeight: number) {
    const node = nodes().find(item => item.dataset.blockId === id)
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const hidden = Math.max(0, node.offsetHeight - compactHeight)
    animations.current.push(node.animate([
      { clipPath: `inset(0 0 ${hidden}px 0 round 15px)` },
      { clipPath: 'inset(0 0 0px 0 round 15px)' },
    ], { duration: 360, easing: 'cubic-bezier(.22,.8,.3,1)' }))
    node.querySelectorAll('video,iframe').forEach(media => animations.current.push(media.animate([
      { opacity: 0, transform: 'translateY(-8px)' }, { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 360, easing: 'ease-out' })))
  }
  useLayoutEffect(() => {
    const snapshot = before.current
    before.current = null
    if (!snapshot) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      container.current?.style.removeProperty('height')
      return
    }
    animations.current.forEach(animation => animation.cancel())
    const items = nodes()
    const finalListHeight = items.reduce((height, node) => height + node.offsetHeight + (parseFloat(getComputedStyle(node).marginBottom) || 0), 0)
    const destinations = new Map(items.map(node => [node, contentRect(node)]))
    animations.current = items.map(node => {
      const old = snapshot.get(node.dataset.blockId!)
      const next = destinations.get(node)!
      return node.animate(old ? [
        { transform: `translateY(${old.top - next.top}px)` }, { transform: 'translateY(0)' },
      ] : [
        { height: '0px', opacity: 0, transform: 'translateY(14px)' },
        { height: `${next.height}px`, opacity: 1, transform: 'translateY(0)' },
      ], { duration: 420, easing: 'cubic-bezier(.22,.8,.3,1)' })
    })
    // Animate the list's occupied height too, so the add-block panel below it
    // follows the cards instead of jumping immediately to its final position.
    const list = container.current
    const oldList = snapshot.get('__block_list__')
    if (list && oldList) {
      const height = finalListHeight
      if (Math.abs(oldList.height - height) > 1) {
        const animation = list.animate([
          { height: `${oldList.height}px` }, { height: `${height}px` },
        ], { duration: 420, easing: 'cubic-bezier(.22,.8,.3,1)', fill: 'forwards' })
        animations.current.push(animation)
        void animation.finished.then(() => {
          if (animations.current.includes(animation)) { list.style.removeProperty('height'); animation.cancel() }
        }).catch(() => { /* A newer edit may replace this transition. */ })
      } else list.style.removeProperty('height')
    }
    if (pendingVideo.current) {
      revealVideo(pendingVideo.current.id, pendingVideo.current.compactHeight)
      pendingVideo.current = null
    }
  }, [signature])
  useEffect(() => () => { session.current?.(); animations.current.forEach(animation => animation.cancel()) }, [])

  function start(event: ReactPointerEvent<HTMLElement>, id: string) {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button,input,select,textarea,a')) return
    const node = event.currentTarget.closest<HTMLElement>('[data-block-id]')
    const workspace = node?.closest('main')
    if (!node || !workspace) return
    session.current?.()
    const handle = event.currentTarget
    const pointer = event.pointerId
    handle.setPointerCapture(pointer)
    const origin = event.clientY
    const original = node.getBoundingClientRect()
    const grabOffset = Math.min(origin - original.top, 45)
    const oldSelection = document.body.style.userSelect
    const oldScrollBehavior = workspace.style.scrollBehavior
    const maxScroll = Math.max(0, workspace.scrollHeight - workspace.clientHeight)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const items = nodes()
    const positions = new Map(items.map(item => [item.dataset.blockId!, {
      top: item.offsetTop, height: item.offsetHeight,
      gap: parseFloat(getComputedStyle(item).marginBottom) || 0,
    }]))
    let y = origin, dragging = false, settling = false, frame = 0, disposed = false
    let order = [...latest.current.ids]
    let ghost: HTMLElement | null = null
    let placeholder: HTMLDivElement | null = null
    let dropAnimation: Animation | null = null
    let compactAnimation: Animation | null = null
    let compactHeight = original.height
    const compactVideo = node.dataset.blockKind === 'video' && !!node.querySelector('video,iframe')
    const shifts = new Map<HTMLElement, Animation>()
    function slots() {
      let top = Math.min(...Array.from(positions.values(), value => value.top))
      const result = new Map<string, number>()
      order.forEach(key => {
        result.set(key, top)
        const size = positions.get(key)!
        top += size.height + size.gap
      })
      return result
    }
    function reserveSpace() {
      const target = slots()
      items.forEach(item => {
        const key = item.dataset.blockId!
        if (key === id) return
        const current = getComputedStyle(item).transform
        shifts.get(item)?.cancel()
        const transform = `translateY(${target.get(key)! - positions.get(key)!.top}px)`
        item.style.transform = transform
        if (!reduced) shifts.set(item, item.animate([{ transform: current === 'none' ? 'translateY(0)' : current }, { transform }], { duration: 240, easing: 'cubic-bezier(.22,.8,.3,1)' }))
      })
      if (placeholder) placeholder.style.top = `${target.get(id)}px`
    }
    function createGhost() {
      animations.current.forEach(animation => animation.cancel())
      container.current?.style.removeProperty('height')
      document.body.style.userSelect = 'none'
      workspace!.style.scrollBehavior = 'auto'
      node!.style.opacity = '0'
      node!.style.pointerEvents = 'none'
      ghost = node!.cloneNode(true) as HTMLElement
      ghost.removeAttribute('id')
      ghost.removeAttribute('data-block-id')
      ghost.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'))
      ghost.querySelectorAll('iframe,video,audio').forEach(element => element.removeAttribute('src'))
      ghost.inert = true
      ghost.dataset.dragGhost = 'true'
      const computed = getComputedStyle(node!)
      const bounds = workspace!.getBoundingClientRect()
      Object.assign(ghost.style, {
        position: 'fixed', left: `${original.left}px`, top: '0', width: `${original.width}px`,
        height: `${Math.min(original.height, bounds.height - 16)}px`, margin: '0',
        zIndex: '10000', pointerEvents: 'none', opacity: '.97', overflow: 'hidden',
        boxSizing: 'border-box', contain: 'layout paint', font: computed.font,
        background: computed.backgroundColor, border: '1px solid #c89772',
        boxShadow: '0 16px 36px #26333b28', willChange: 'transform',
      })
      for (const variable of ['--ink', '--muted', '--accent', '--line']) ghost.style.setProperty(variable, computed.getPropertyValue(variable))
      document.body.append(ghost)
      if (compactVideo) {
        ghost.querySelectorAll<HTMLElement>('video,iframe,[data-drag-video-extra]').forEach(element => { element.style.display = 'none' })
        ghost.style.height = 'auto'
        compactHeight = Math.min(ghost.offsetHeight, bounds.height - 16)
        ghost.style.height = `${compactHeight}px`
        if (!reduced) compactAnimation = ghost.animate([
          { height: `${Math.min(original.height, bounds.height - 16)}px` },
          { height: `${compactHeight}px` },
        ], { duration: 240, easing: 'cubic-bezier(.22,.8,.3,1)' })
      }
      placeholder = document.createElement('div')
      placeholder.dataset.blockPlaceholder = 'true'
      placeholder.setAttribute('aria-hidden', 'true')
      Object.assign(placeholder.style, {
        position: 'absolute', left: '0', right: '0', top: `${positions.get(id)!.top}px`,
        height: `${original.height}px`, boxSizing: 'border-box', border: '2px dashed #c89772',
        borderRadius: '15px', background: '#f4eadf80', pointerEvents: 'none',
      })
      container.current!.append(placeholder)
    }
    function update() {
      if (!dragging || settling || disposed) return
      const bounds = workspace!.getBoundingClientRect()
      const inside = y >= bounds.top - 16 && y <= bounds.bottom + 16
      const speed = !inside ? 0 : y < bounds.top + 65 ? -Math.min(16, (bounds.top + 65 - y) / 4) : y > bounds.bottom - 65 ? Math.min(16, (y - bounds.bottom + 65) / 4) : 0
      if (speed) workspace!.scrollTop = Math.max(0, Math.min(maxScroll, workspace!.scrollTop + speed))
      const height = ghost!.offsetHeight
      const top = Math.max(bounds.top + 8, Math.min(bounds.bottom - height - 8, y - grabOffset))
      ghost!.style.transform = `translate3d(0, ${top}px, 0)`
      const contentY = Math.max(bounds.top, Math.min(bounds.bottom, y)) - container.current!.getBoundingClientRect().top
      const target = slots()
      const remaining = order.filter(key => key !== id)
      let insertion = remaining.findIndex(key => contentY < target.get(key)! + positions.get(key)!.height / 2)
      if (insertion < 0) insertion = remaining.length
      const next = [...remaining.slice(0, insertion), id, ...remaining.slice(insertion)]
      if (next.join(',') !== order.join(',')) { order = next; reserveSpace() }
      frame = requestAnimationFrame(update)
    }
    function move(e: PointerEvent) {
      if (e.pointerId !== pointer || settling) return
      y = e.clientY
      if (!dragging && Math.abs(y - origin) > 5) {
        dragging = true
        createGhost()
        update()
      }
      if (dragging) e.preventDefault()
    }
    function cleanup() {
      if (disposed) return
      disposed = true
      cancelAnimationFrame(frame)
      dropAnimation?.cancel()
      compactAnimation?.cancel()
      shifts.forEach(animation => animation.cancel())
      document.body.style.userSelect = oldSelection
      workspace!.style.scrollBehavior = oldScrollBehavior
      if (handle.hasPointerCapture(pointer)) handle.releasePointerCapture(pointer)
      node!.style.removeProperty('opacity')
      node!.style.removeProperty('pointer-events')
      items.forEach(item => item.style.removeProperty('transform'))
      ghost?.remove()
      placeholder?.remove()
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('keydown', keyboard)
      window.removeEventListener('blur', cancel)
      session.current = null
    }
    async function finish(e: PointerEvent) {
      if (e.pointerId !== pointer || settling) return
      if (!dragging) { cleanup(); return }
      settling = true
      cancelAnimationFrame(frame)
      compactAnimation?.cancel()
      if (ghost && placeholder && !reduced) {
        const bounds = workspace!.getBoundingClientRect()
        let rect = placeholder.getBoundingClientRect()
        const adjustment = rect.height > bounds.height - 16 || rect.top < bounds.top + 8
          ? rect.top - bounds.top - 8
          : rect.bottom > bounds.bottom - 8 ? rect.bottom - bounds.bottom + 8 : 0
        if (adjustment) {
          workspace!.scrollTop = Math.max(0, Math.min(maxScroll, workspace!.scrollTop + adjustment))
          rect = placeholder.getBoundingClientRect()
        }
        // The floating card stays clipped to the visible editor even for very tall blocks.
        const height = Math.min(ghost.offsetHeight, bounds.height - 16)
        const top = Math.max(bounds.top + 8, Math.min(bounds.bottom - height - 8, rect.top))
        dropAnimation = ghost.animate([
          { transform: ghost.style.transform, opacity: .97 },
          { transform: `translate3d(0, ${top}px, 0)`, opacity: 1 },
        ], { duration: 300, easing: 'cubic-bezier(.22,.8,.3,1)', fill: 'forwards' })
        try { await dropAnimation.finished } catch { return }
      }
      if (disposed) return
      // Capture the already shifted destination positions so committing order cannot jump back.
      before.current = new Map(items.map(item => [item.dataset.blockId!, contentRect(item === node && placeholder ? placeholder : item)]))
      const changed = order.join(',') !== latest.current.ids.join(',')
      cleanup()
      if (changed) {
        if (compactVideo && !reduced) pendingVideo.current = { id, compactHeight }
        latest.current.reorder(order)
      } else {
        before.current = null
        if (compactVideo) revealVideo(id, compactHeight)
      }
    }
    function cancel() { before.current = null; cleanup() }
    function keyboard(e: KeyboardEvent) { if (e.key === 'Escape') cancel() }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', keyboard)
    window.addEventListener('blur', cancel)
    session.current = cleanup
  }
  return { container, capture, start }
}

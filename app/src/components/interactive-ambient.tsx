'use client'

import { useEffect, useRef } from 'react'

/** A decorative spring, updated outside React so pointer movement never rerenders the form. */
export function InteractiveAmbient({ className }: { className: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let previousTime = 0
    let x = 0, y = 0, vx = 0, vy = 0
    let targetX = 0, targetY = 0

    function animate(time: number) {
      const dt = Math.min((time - previousTime) / 1000 || 1 / 60, 1 / 30)
      previousTime = time
      // An underdamped spring gives both contact and release a gentle rebound.
      vx += ((targetX - x) * 145 - vx * 12) * dt
      vy += ((targetY - y) * 145 - vy * 12) * dt
      x += vx * dt
      y += vy * dt
      const length = Math.hypot(x, y)
      const nx = length ? x / length : 0
      const ny = length ? y / length : 0
      const stretch = Math.min(length / 280, .16)
      const a = 1 + stretch * (nx * nx - .45 * ny * ny)
      const b = stretch * 1.45 * nx * ny
      const d = 1 + stretch * (ny * ny - .45 * nx * nx)
      element!.style.transform = `matrix(${a}, ${b}, ${b}, ${d}, ${x}, ${y})`
      element!.style.borderRadius = `${50 + x * .12}% ${50 - x * .12}% ${50 + y * .12}% ${50 - y * .12}%`
      if (Math.hypot(targetX - x, targetY - y) + Math.hypot(vx, vy) > .08) {
        frame = requestAnimationFrame(animate)
      } else {
        frame = 0
        previousTime = 0
        if (!targetX && !targetY) {
          element!.style.removeProperty('transform')
          element!.style.removeProperty('border-radius')
        }
      }
    }

    function start() {
      if (!frame) frame = requestAnimationFrame(animate)
    }

    function release() {
      targetX = targetY = 0
      if (x || y || vx || vy) start()
    }

    function move(event: PointerEvent) {
      if (event.pointerType === 'touch' || motion.matches) return
      // The outer wrapper drifts independently; measure it rather than the spring surface.
      const rect = element!.parentElement!.getBoundingClientRect()
      if (!rect.width) return
      const bounds = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, radius: rect.width / 2 }
      const dx = event.clientX - bounds.x
      const dy = event.clientY - bounds.y
      const distance = Math.hypot(dx, dy)
      const proximity = Math.max(0, Math.min(1, (bounds.radius + 72 - distance) / 120))
      const influence = proximity * proximity * (3 - 2 * proximity)
      const pull = Math.min(distance * .18, 44) * influence
      targetX = distance ? dx / distance * pull : 0
      targetY = distance ? dy / distance * pull : 0
      if (targetX || targetY || x || y) start()
    }

    function invalidate() { release() }
    function leave(event: PointerEvent) { if (!event.relatedTarget) release() }
    function preferenceChanged() {
      cancelAnimationFrame(frame)
      frame = previousTime = x = y = vx = vy = targetX = targetY = 0
      element!.style.removeProperty('transform')
      element!.style.removeProperty('border-radius')
    }

    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerout', leave, { passive: true })
    window.addEventListener('blur', release)
    window.addEventListener('resize', invalidate)
    window.addEventListener('scroll', invalidate, { passive: true })
    motion.addEventListener('change', preferenceChanged)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerout', leave)
      window.removeEventListener('blur', release)
      window.removeEventListener('resize', invalidate)
      window.removeEventListener('scroll', invalidate)
      motion.removeEventListener('change', preferenceChanged)
    }
  }, [])

  return <div className={`ambient ${className}`} aria-hidden="true"><div ref={ref} className="ambient-surface" /></div>
}

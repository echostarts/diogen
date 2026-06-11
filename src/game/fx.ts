import type { World } from './world'

/** Частицы, цифры урона, всплывающие подписи, тряска. Работает и во время hitstop. */
export function updateFx(w: World, dt: number): void {
  for (let i = w.partCount - 1; i >= 0; i--) {
    const p = w.parts[i]
    p.life -= dt
    if (p.life <= 0) {
      w.partCount--
      if (i !== w.partCount) {
        const tmp = w.parts[i]
        w.parts[i] = w.parts[w.partCount]
        w.parts[w.partCount] = tmp
      }
      continue
    }
    const dec = Math.max(0, 1 - p.drag * dt)
    p.vx *= dec
    p.vy *= dec
    p.x += p.vx * dt
    p.y += p.vy * dt
  }

  for (let i = w.numCount - 1; i >= 0; i--) {
    const n = w.nums[i]
    n.t += dt
    n.y -= 34 * dt
    if (n.t > 0.7) {
      w.numCount--
      if (i !== w.numCount) {
        const tmp = w.nums[i]
        w.nums[i] = w.nums[w.numCount]
        w.nums[w.numCount] = tmp
      }
    }
  }

  for (let i = 0; i < w.floaters.length; i++) {
    const f = w.floaters[i]
    if (f.t > 0) {
      f.t -= dt
      f.y -= 16 * dt
    }
  }

  if (w.captionT > 0) w.captionT -= dt
  if (w.trauma > 0) w.trauma = Math.max(0, w.trauma - dt * 1.9)
}

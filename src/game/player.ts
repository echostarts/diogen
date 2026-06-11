import { CFG, PC_OCHRE } from '../config'
import type { World } from './world'

export function updatePlayer(w: World, dt: number, mx: number, my: number, dashPressed: boolean): void {
  const p = w.player
  if (p.dead) return
  const speed = w.moveSpeed()
  const B = CFG.barrel

  if (dashPressed && w.weapons.barrel > 0 && p.charge >= 1 && p.dashT <= 0) {
    p.dashT = B.dashT
    p.charge = 0
    if (Math.hypot(mx, my) > 0.1) {
      const l = Math.hypot(mx, my)
      p.dashX = mx / l
      p.dashY = my / l
    } else {
      p.dashX = p.facing
      p.dashY = 0
    }
    w.audio.dash()
    w.burst(p.x, p.y, 8, PC_OCHRE, 120, 2.5, 0.35)
  }

  if (p.dashT > 0) {
    p.dashT -= dt
    p.vx = p.dashX * speed * B.dashMul
    p.vy = p.dashY * speed * B.dashMul
    // шлейф рывка
    w.spawnPart(p.x, p.y, -p.vx * 0.1, -p.vy * 0.1, 0.3, 3, PC_OCHRE, 4)
  } else {
    p.vx = mx * speed
    p.vy = my * speed
  }

  p.x += p.vx * dt
  p.y += p.vy * dt
  const v = Math.hypot(p.vx, p.vy)
  p.dist += v * dt
  if (Math.abs(p.vx) > 1) p.facing = p.vx > 0 ? 1 : -1

  // заряд рывка копится при движении (когда бочка-таран открыта)
  if (w.weapons.barrel > 0 && p.dashT <= 0 && v > speed * 0.4) {
    const chargeTime = B.charge * (1 - 0.12 * (w.weapons.barrel - 1))
    p.charge = Math.min(1, p.charge + dt / chargeTime)
  }

  if (p.invuln > 0) p.invuln -= dt
}

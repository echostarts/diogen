import { CFG, PC_OLIVE, PC_CREAM } from '../config'
import type { World } from './world'

export function updateGems(w: World, dt: number): void {
  const p = w.player
  if (p.dead) return
  const magnet = w.magnetR()
  for (let i = w.gemCount - 1; i >= 0; i--) {
    const g = w.gems[i]
    g.t += dt
    const dx = p.x - g.x
    const dy = p.y - g.y
    const d = Math.hypot(dx, dy) || 0.001
    if (d < CFG.player.pickup) {
      w.addXp(g.v)
      w.burst(g.x, g.y, 2, PC_OLIVE, 70, 2, 0.3)
      w.spawnPart(g.x, g.y, 0, -40, 0.3, 2, PC_CREAM, 2)
      w.audio.pick()
      w.removeGem(i)
      continue
    }
    if (d < magnet || g.pull > 0) {
      g.pull = Math.min(900, g.pull + 1500 * dt)
      g.x += (dx / d) * g.pull * dt
      g.y += (dy / d) * g.pull * dt
    }
  }
}

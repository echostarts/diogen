import { CFG, EK_GUARD, PC_CREAM, PC_GLOW, PC_INK, PC_OCHRE } from '../config'
import type { World } from './world'

export function maybeSpawnBoss(w: World): void {
  if (w.bossSpawned || w.t < CFG.bossAt || w.player.dead) return
  w.bossSpawned = true
  const b = w.boss
  const a = w.rng.next() * Math.PI * 2
  b.active = true
  b.dead = false
  b.x = w.player.x + Math.cos(a) * 480
  b.y = w.player.y + Math.sin(a) * 480
  b.maxHp = w.bossHpOverride ?? CFG.boss.hp
  b.hp = b.maxHp
  b.phase = 0
  b.pt = 2.2
  b.summonCd = 6
  b.touchCd = 0
  b.hitThisDash = false
  // толпа расступается перед царём — арена очищается под дуэль
  for (let i = 0; i < w.enemyCount; i++) w.killEnemy(i, false)
  w.setCaption('АЛЕКСАНДР: «ПРОСИ, ЧЕГО ХОЧЕШЬ»', 4)
  w.addTrauma(0.5)
  w.slowmo = 1.1 // секунда замедления — оценить масштаб гостя
  w.burst(b.x, b.y, 24, PC_OCHRE, 220, 3, 0.8)
  w.audio.boom()
  w.audio.horn()
  w.audio.drone(true)
}

function summon(w: World): void {
  const b = w.boss
  const n = b.hp < b.maxHp * 0.35 ? CFG.boss.summonN + 2 : CFG.boss.summonN
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + w.rng.next() * 0.5
    const x = b.x + Math.cos(a) * 120
    const y = b.y + Math.sin(a) * 120
    if (w.spawnEnemy(EK_GUARD, x, y)) w.burst(x, y, 6, PC_CREAM, 100, 2.5, 0.4)
  }
  w.bossSummons++
  w.audio.thud(true)
}

export function updateBoss(w: World, dt: number): void {
  const b = w.boss
  if (!b.active || b.dead) return
  const p = w.player
  const C = CFG.boss
  if (b.flash > 0) b.flash -= dt
  b.touchCd -= dt
  if (b.dogCd > 0) b.dogCd -= dt
  const enraged = b.hp < b.maxHp * 0.35

  if (b.hp <= 0) {
    // Победа: Александр отходит (в сторону)
    b.dead = true
    w.addTrauma(1)
    w.addHitstop(0.1)
    w.slowmo = 0.9
    w.burst(b.x, b.y, 50, PC_INK, 260, 4, 1)
    w.burst(b.x, b.y, 24, PC_GLOW, 200, 3, 0.8)
    w.burst(b.x, b.y, 16, PC_CREAM, 160, 2.5, 0.7)
    w.audio.boom()
    w.audio.stinger(true)
    w.audio.drone(false)
    // свита разбегается (исчезает без наград)
    for (let i = 0; i < w.enemyCount; i++) w.killEnemy(i, false)
    w.endTimer = 1.6
    w.endState = 2
    return
  }

  let dx = p.x - b.x
  let dy = p.y - b.y
  const d = Math.hypot(dx, dy) || 0.001
  dx /= d
  dy /= d
  b.pt -= dt

  switch (b.phase) {
    case 0: { // преследование
      const sp = enraged ? C.enrageSpeed : C.speed
      b.x += dx * sp * dt
      b.y += dy * sp * dt
      b.facing = dx > 0 ? 1 : -1
      if (b.pt <= 0 && !p.dead) {
        if (b.summonCd <= 0) {
          b.phase = 4
          b.pt = C.cast
        } else {
          // телеграф рывка: полоса-предупреждение
          b.phase = 1
          b.pt = enraged ? C.enrageTelegraph : C.telegraph
          b.dx = dx
          b.dy = dy
          b.dashFull = Math.min(720, Math.max(420, d + 260))
          b.dashLeft = b.dashFull
          b.hitThisDash = false
        }
      }
      break
    }
    case 1: // телеграф
      b.facing = b.dx > 0 ? 1 : -1
      if (b.pt <= 0) {
        b.phase = 2
        w.bossDashes++
        w.audio.dash()
      }
      break
    case 2: { // рывок по прямой
      const step = C.dashSpeed * dt
      b.x += b.dx * step
      b.y += b.dy * step
      b.dashLeft -= step
      w.spawnPart(b.x - b.dx * 20, b.y - b.dy * 20, -b.dx * 60, -b.dy * 60, 0.35, 4, PC_INK, 4)
      if (!b.hitThisDash && !p.dead && p.invuln <= 0) {
        const rx = p.x - b.x
        const ry = p.y - b.y
        const rr = b.r + p.r + 4
        if (rx * rx + ry * ry < rr * rr) {
          b.hitThisDash = true
          w.damagePlayer(C.dashDmg)
        }
      }
      if (b.dashLeft <= 0) {
        b.phase = 3
        b.pt = C.recover
        w.addTrauma(0.3)
        w.audio.thud(true)
        w.burst(b.x + b.dx * b.r, b.y + b.dy * b.r, 10, PC_INK, 150, 3, 0.5)
      }
      break
    }
    case 3: // восстановление
      if (b.pt <= 0) {
        b.phase = 0
        b.pt = C.walkMin + w.rng.next() * C.walkVar
      }
      break
    case 4: // призыв стражи
      if (b.pt <= 0) {
        summon(w)
        b.summonCd = C.summonCd
        b.phase = 0
        b.pt = C.walkMin
      }
      break
  }

  if (b.phase !== 4) b.summonCd -= dt

  // контактный урон тела
  if (!p.dead && p.invuln <= 0 && b.touchCd <= 0) {
    const rx = p.x - b.x
    const ry = p.y - b.y
    const rr = b.r + p.r
    if (rx * rx + ry * ry < rr * rr) {
      b.touchCd = C.touchCd
      w.damagePlayer(C.touchDmg)
    }
  }
}

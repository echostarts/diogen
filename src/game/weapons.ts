import { CFG, PC_CREAM, PC_GLOW, PC_OCHRE } from '../config'
import type { World } from './world'

// Возвращает индекс ближайшего живого врага (или -2, если ближе босс; -1 — никого).
// Дистанция — от (x, y), ограничение maxD. needDogCd — фильтр для псов.
let nearestDist = 0
function nearestTarget(w: World, x: number, y: number, maxD: number, needDogCd: boolean): number {
  let best = -1
  let bestD = maxD * maxD
  for (let i = 0; i < w.enemyCount; i++) {
    const e = w.enemies[i]
    if (e.dying) continue
    if (needDogCd && e.dogCd > 0) continue
    const dx = e.x - x
    const dy = e.y - y
    const d2 = dx * dx + dy * dy
    if (d2 < bestD) { bestD = d2; best = i }
  }
  const b = w.boss
  if (b.active && !b.dead && !(needDogCd && b.dogCd > 0)) {
    const dx = b.x - x
    const dy = b.y - y
    const d2 = dx * dx + dy * dy
    if (d2 < bestD) { bestD = d2; best = -2 }
  }
  nearestDist = Math.sqrt(bestD)
  return best
}

function lanternStats(w: World): { dmg: number; radius: number; orbit: number } {
  const lvl = w.weapons.lantern
  const L = CFG.lantern
  let dmg = L.dmg * (1 + 0.3 * (lvl - 1)) * w.dmgMult()
  let radius = L.radius * (1 + 0.08 * (lvl - 1)) * w.areaMult()
  let orbit = L.orbit * Math.sqrt(w.areaMult())
  if (w.sun) {
    // эволюция: свет идёт от самой бочки — шире и жарче
    dmg *= CFG.sun.dmgMul
    radius *= CFG.sun.radiusMul
    orbit = 0
  }
  return { dmg, radius, orbit }
}

export function lanternCenter(w: World, out: { x: number; y: number; r: number }): void {
  const s = lanternStats(w)
  out.x = w.player.x + Math.cos(w.lanternAngle) * s.orbit
  out.y = w.player.y + Math.sin(w.lanternAngle) * s.orbit
  out.r = s.radius
}

const lanternPos = { x: 0, y: 0, r: 0 }

function updateLantern(w: World, dt: number): void {
  if (w.weapons.lantern <= 0) return
  w.lanternAngle += CFG.lantern.spin * dt
  if (w.lanternPulse > 0) w.lanternPulse -= dt
  w.lanternTick -= dt
  if (w.lanternTick > 0) return
  w.lanternTick = CFG.lantern.int * w.intMult() * (w.sun ? CFG.sun.intMul : 1)
  w.lanternPulse = 0.16

  const s = lanternStats(w)
  lanternCenter(w, lanternPos)
  const cx = lanternPos.x
  const cy = lanternPos.y
  const n = w.hash.query(cx, cy, s.radius + 20)
  for (let k = 0; k < n; k++) {
    const i = w.hash.out[k]
    const e = w.enemies[i]
    if (e.dying) continue
    const dx = e.x - cx
    const dy = e.y - cy
    if (dx * dx + dy * dy <= s.radius * s.radius) {
      w.damageEnemy(i, s.dmg, cx, cy, CFG.lantern.kb)
    }
  }
  // Александр под фонарём получает +50%: «не заслоняй солнце»
  const b = w.boss
  if (b.active && !b.dead) {
    const dx = b.x - cx
    const dy = b.y - cy
    const d2 = dx * dx + dy * dy
    if (d2 <= s.radius * s.radius) {
      w.damageBoss(s.dmg * CFG.boss.lanternBonus, true)
      w.lanternProcs++
      if (w.lanternProcs === 1) {
        w.setCaption('«ОТОЙДИ, ТЫ ЗАСЛОНЯЕШЬ МНЕ СОЛНЦЕ»', 3.5)
        w.floatText(b.x, b.y - b.r - 26, 'НА СВЕТУ: УРОН +50%')
      }
      w.burst(b.x, b.y - b.r, 5, PC_GLOW, 90, 2.5, 0.4)
    } else if (d2 <= (s.radius + b.r) * (s.radius + b.r)) {
      w.damageBoss(s.dmg, false)
    }
  }
}

function updateSpit(w: World, dt: number): void {
  if (w.weapons.spit <= 0) return
  w.spitTick -= dt
  if (w.spitTick > 0) return
  const lvl = w.weapons.spit
  const S = CFG.spit
  const p = w.player
  const t = nearestTarget(w, p.x, p.y, S.range, false)
  if (t === -1) {
    w.spitTick = 0.08 // цели нет — пробуем чаще, кулдаун не сжигаем
    return
  }
  w.spitTick = S.int * (1 - 0.06 * (lvl - 1)) * w.intMult()
  let tx: number
  let ty: number
  if (t === -2) { tx = w.boss.x; ty = w.boss.y } else { tx = w.enemies[t].x; ty = w.enemies[t].y }
  let dx = tx - p.x
  let dy = ty - p.y
  const d = Math.hypot(dx, dy) || 1
  dx /= d
  dy /= d
  const dmg = S.dmg * (1 + 0.25 * (lvl - 1)) * w.dmgMult()
  const pierce = 1 + w.pass.pierce
  w.spawnProj(p.x + dx * 12, p.y + dy * 12 - 6, dx * S.speed, dy * S.speed, S.r, dmg, pierce, 1.6, false)
  w.audio.shoot()
}

function updateDogs(w: World, dt: number): void {
  const lvl = w.weapons.dogs
  const want = lvl > 0 ? Math.min(CFG.dogs.base + w.pass.dog, w.dogs.length) : 0
  const p = w.player
  while (w.dogCount < want) {
    const d = w.dogs[w.dogCount++]
    // только логический rng — иначе раны с ?seed= недетерминированы
    d.x = p.x + (w.rng.next() - 0.5) * 30
    d.y = p.y + (w.rng.next() - 0.5) * 30
    d.state = 0
    d.tIdx = -1
    d.timer = 0.2
  }
  if (want === 0) { w.dogCount = 0; return }

  const D = CFG.dogs
  const speed = D.speed * (1 + 0.08 * (lvl - 1))
  const dmg = D.dmg * (1 + 0.28 * (lvl - 1)) * w.dmgMult()

  for (let di = 0; di < w.dogCount; di++) {
    const d = w.dogs[di]
    if (d.state === 1) {
      // проверяем, что цель ещё жива и не «переехала» при уплотнении пула
      let tx = 0
      let ty = 0
      let tr = 0
      let valid = false
      if (d.tIdx === -2) {
        const b = w.boss
        if (b.active && !b.dead) { tx = b.x; ty = b.y; tr = b.r; valid = true }
      } else if (d.tIdx >= 0 && d.tIdx < w.enemyCount) {
        const e = w.enemies[d.tIdx]
        if (!e.dying && e.uid === d.tUid) { tx = e.x; ty = e.y; tr = e.r; valid = true }
      }
      if (!valid) {
        d.state = 0
        d.timer = 0.05
      } else {
        let dx = tx - d.x
        let dy = ty - d.y
        const dist = Math.hypot(dx, dy) || 0.001
        dx /= dist
        dy /= dist
        d.x += dx * speed * dt
        d.y += dy * speed * dt
        d.facing = dx > 0 ? 1 : -1
        if (w.fxr.next() < 0.3) w.spawnPart(d.x, d.y + 4, -dx * 30, 5, 0.25, 2, PC_OCHRE, 4)
        if (dist < tr + 8) {
          if (d.tIdx === -2) {
            w.damageBoss(dmg, false)
            w.boss.dogCd = D.hitCd
          } else {
            w.damageEnemy(d.tIdx, dmg, d.x - dx * 10, d.y - dy * 10, 120)
            w.enemies[d.tIdx].dogCd = D.hitCd
          }
          w.audio.dogBite()
          // цепочка: следующая жертва рядом с псом
          const nt = nearestTarget(w, d.x, d.y, D.chain, true)
          if (nt !== -1) {
            d.tIdx = nt
            d.tUid = nt >= 0 ? w.enemies[nt].uid : 0
          } else {
            d.state = 2
          }
        }
      }
    } else if (d.state === 2) {
      // возврат к игроку
      let dx = p.x - d.x
      let dy = p.y - d.y
      const dist = Math.hypot(dx, dy) || 0.001
      d.x += (dx / dist) * speed * 0.8 * dt
      d.y += (dy / dist) * speed * 0.8 * dt
      d.facing = dx > 0 ? 1 : -1
      if (dist < 40) { d.state = 0; d.timer = 0.25 }
    } else {
      // трусит рядом с игроком, высматривает цель
      const a = w.t * 2.4 + d.seed * Math.PI * 2
      const hx = p.x + Math.cos(a) * 34
      const hy = p.y + Math.sin(a) * 26
      d.x += (hx - d.x) * Math.min(1, dt * 6)
      d.y += (hy - d.y) * Math.min(1, dt * 6)
      d.facing = hx > d.x - 1 ? (p.facing as number) : d.facing
      d.timer -= dt
      if (d.timer <= 0) {
        d.timer = 0.2
        const nt = nearestTarget(w, d.x, d.y, D.acquire, true)
        if (nt !== -1 && nearestDist > 1) {
          d.state = 1
          d.tIdx = nt
          d.tUid = nt >= 0 ? w.enemies[nt].uid : 0
        }
      }
    }
  }
}

function updateRam(w: World): void {
  if (w.weapons.barrel <= 0) return
  const p = w.player
  if (p.dead) return
  const B = CFG.barrel
  const v = Math.hypot(p.vx, p.vy)
  const dashing = p.dashT > 0
  if (!dashing && v < w.moveSpeed() * B.thresh) return
  const lvl = w.weapons.barrel
  const dmg = B.dmg * (1 + 0.3 * (lvl - 1)) * w.dmgMult() * (dashing ? B.dashDmg : 1)
  const n = w.hash.query(p.x, p.y, p.r + 30)
  for (let k = 0; k < n; k++) {
    const i = w.hash.out[k]
    const e = w.enemies[i]
    if (e.dying || e.ramCd > 0) continue
    const dx = e.x - p.x
    const dy = e.y - p.y
    const rr = e.r + p.r + 4
    if (dx * dx + dy * dy >= rr * rr) continue
    e.ramCd = B.hitCd
    w.damageEnemy(i, dmg, p.x - p.vx * 0.05, p.y - p.vy * 0.05, B.kb * (dashing ? 1.4 : 1))
  }
  const b = w.boss
  if (b.active && !b.dead && b.touchCd <= -0.2) {
    const dx = b.x - p.x
    const dy = b.y - p.y
    const rr = b.r + p.r + 4
    if (dx * dx + dy * dy < rr * rr) {
      w.damageBoss(dmg, false)
      b.touchCd = 0.3 // не душить босса каждый тик тараном
    }
  }
}

function updateProjs(w: World, dt: number): void {
  const p = w.player
  for (let i = w.projCount - 1; i >= 0; i--) {
    const pr = w.projs[i]
    pr.x += pr.vx * dt
    pr.y += pr.vy * dt
    pr.life -= dt
    if (pr.life <= 0) { w.removeProj(i); continue }

    if (pr.hostile) {
      if (!p.dead && p.invuln <= 0) {
        const dx = p.x - pr.x
        const dy = p.y - pr.y
        const rr = p.r + pr.r
        if (dx * dx + dy * dy < rr * rr) {
          w.damagePlayer(pr.dmg)
          w.removeProj(i)
          continue
        }
      }
      if (w.fxr.next() < 0.2) w.spawnPart(pr.x, pr.y, 0, 0, 0.2, 2, PC_OCHRE, 2)
      continue
    }

    // дружественный плевок
    if (w.fxr.next() < 0.35) w.spawnPart(pr.x, pr.y, -pr.vx * 0.05, -pr.vy * 0.05, 0.18, 1.8, PC_CREAM, 2)
    const n = w.hash.query(pr.x, pr.y, pr.r + 22)
    let dead = false
    for (let k = 0; k < n; k++) {
      const ei = w.hash.out[k]
      const e = w.enemies[ei]
      if (e.dying || e.uid === pr.lastUid) continue
      const dx = e.x - pr.x
      const dy = e.y - pr.y
      const rr = e.r + pr.r
      if (dx * dx + dy * dy >= rr * rr) continue
      w.damageEnemy(ei, pr.dmg, pr.x - pr.vx * 0.02, pr.y - pr.vy * 0.02, CFG.spit.kb)
      pr.lastUid = e.uid
      pr.pierce--
      if (pr.pierce <= 0) { dead = true; break }
    }
    if (!dead) {
      const b = w.boss
      if (b.active && !b.dead && pr.lastUid !== -7) {
        const dx = b.x - pr.x
        const dy = b.y - pr.y
        const rr = b.r + pr.r
        if (dx * dx + dy * dy < rr * rr) {
          w.damageBoss(pr.dmg, false)
          pr.lastUid = -7 // в босса дважды одним плевком не попадаем
          pr.pierce--
          if (pr.pierce <= 0) dead = true
        }
      }
    }
    if (dead) w.removeProj(i)
  }
}

export function updateWeapons(w: World, dt: number): void {
  updateLantern(w, dt)
  updateSpit(w, dt)
  updateDogs(w, dt)
  updateRam(w)
  updateProjs(w, dt)
}

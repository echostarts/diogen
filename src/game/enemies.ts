import { CFG, EK_GUARD, EK_MERCHANT, EK_PLATO, EK_PLATONIST, EK_SOPHIST, PC_CREAM } from '../config'
import type { World } from './world'

// Веса спавна по фазам рана: [торговец, стражник, платоник, софист]
const MIX: Array<[number, number, number, number, number]> = [
  // [до секунды, m, g, p, s]
  [30, 0.75, 0.25, 0, 0],
  [80, 0.5, 0.38, 0, 0.12],
  [150, 0.36, 0.34, 0.14, 0.16],
  [240, 0.3, 0.3, 0.2, 0.2],
  [9999, 0.26, 0.3, 0.24, 0.2],
]

function pickKind(w: World): number {
  const t = w.t
  let row = MIX[MIX.length - 1]
  for (let i = 0; i < MIX.length; i++) {
    if (t < MIX[i][0]) { row = MIX[i]; break }
  }
  let roll = w.rng.next()
  if ((roll -= row[1]) < 0) return EK_MERCHANT
  if ((roll -= row[2]) < 0) return EK_GUARD
  if ((roll -= row[3]) < 0) return EK_PLATONIST
  return EK_SOPHIST
}

function spawnRate(t: number): number {
  const pts = CFG.spawn.rate
  if (t <= pts[0][0]) return pts[0][1]
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const k = (t - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0])
      return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k
    }
  }
  return pts[pts.length - 1][1]
}

function spawnAt(w: World, kind: number, angle: number, dist: number): void {
  const x = w.player.x + Math.cos(angle) * dist
  const y = w.player.y + Math.sin(angle) * dist
  const e = w.spawnEnemy(kind, x, y)
  // видный гражданин: толще, злее, щедрее на оливки
  const E = CFG.elite
  if (e && w.t >= E.after && w.rng.next() < E.chance) {
    e.elite = true
    e.maxHp = Math.round(e.maxHp * E.hpMul)
    e.hp = e.maxHp
    e.r *= E.rMul
    e.dmg = Math.round(e.dmg * E.dmgMul)
    e.speed *= E.spdMul
    e.xp = E.xp
  }
}

export function spawnerTick(w: World, dt: number): void {
  if (w.player.dead) return
  let rate = spawnRate(w.t)
  if (w.bossSpawned) rate *= CFG.spawn.afterBossMul
  w.spawnAcc += rate * dt
  while (w.spawnAcc >= 1) {
    w.spawnAcc -= 1
    if (w.enemyCount >= w.enemies.length - 8) continue
    spawnAt(w, pickKind(w), w.rng.next() * Math.PI * 2, CFG.spawn.ringDist * (0.96 + w.rng.next() * 0.12))
  }
  // мини-босс: сам Платон приходит на 2:30
  if (!w.miniSpawned && w.t >= CFG.mini.at && !w.bossSpawned) {
    w.miniSpawned = true
    const a = w.rng.next() * Math.PI * 2
    const e = w.spawnEnemy(EK_PLATO, w.player.x + Math.cos(a) * 620, w.player.y + Math.sin(a) * 620)
    if (e) {
      e.fire = 3 // первый призыв — через три секунды
      w.setCaption('ПЛАТОН ПРИШЁЛ ЗА СВОИМ ПЕТУХОМ', 3.5)
      w.audio.thud(true)
      w.audio.horn()
    }
  }
  // волны-кольца по расписанию
  const bursts = CFG.spawn.bursts
  if (!w.bossSpawned && w.burstIdx < bursts.length && w.t >= bursts[w.burstIdx]) {
    const n = 10 + Math.floor(w.t / 34)
    const a0 = w.rng.next() * Math.PI * 2
    const kind = pickKind(w)
    for (let i = 0; i < n; i++) {
      if (w.enemyCount >= w.enemies.length - 8) break
      spawnAt(w, kind, a0 + (i / n) * Math.PI * 2, CFG.spawn.ringDist)
    }
    w.burstIdx++
    w.audio.horn()
  }
}

export function updateEnemies(w: World, dt: number): void {
  const p = w.player
  const S = CFG.sophist
  for (let i = 0; i < w.enemyCount; i++) {
    const e = w.enemies[i]
    if (e.dying) continue
    if (e.flash > 0) e.flash -= dt
    if (e.ramCd > 0) e.ramCd -= dt
    if (e.dogCd > 0) e.dogCd -= dt

    let dx = p.x - e.x
    let dy = p.y - e.y
    const d = Math.hypot(dx, dy) || 0.001
    dx /= d
    dy /= d

    let sx = 0
    let sy = 0
    if (e.kind === EK_SOPHIST) {
      // держит дистанцию и кидает медленные свитки
      if (d > S.far) { sx = dx; sy = dy }
      else if (d < S.near) { sx = -dx; sy = -dy }
      else {
        const dir = e.seed > 0.5 ? 1 : -1
        sx = -dy * dir * 0.7
        sy = dx * dir * 0.7
      }
      e.fire -= dt
      if (e.fire <= 0 && d < S.fireRange && !p.dead) {
        e.fire = S.fireCd * (0.85 + e.seed * 0.3)
        w.spawnProj(e.x, e.y, dx * S.projSpeed, dy * S.projSpeed, S.projR, S.projDmg, 1, 5, true)
      }
    } else if (e.kind === EK_MERCHANT) {
      // лёгкое виляние, чтобы толпа не шла строем
      const wob = Math.sin(w.t * 3.1 + e.seed * 6.28) * 0.45
      sx = dx - dy * wob
      sy = dy + dx * wob
    } else if (e.kind === EK_PLATO) {
      // сам Платон: степенный вблизи, но неотвратимый — издали нагоняет
      const chase = Math.min(1.8, Math.max(1, d / 350))
      sx = dx * chase
      sy = dy * chase
      e.fire -= dt
      if (e.fire <= 0 && !p.dead) {
        e.fire = CFG.mini.summonCd
        for (let k = 0; k < CFG.mini.summonN; k++) {
          if (w.enemyCount >= w.enemies.length - 8) break
          const a = (k / CFG.mini.summonN) * Math.PI * 2 + e.seed * 6.28
          const sx2 = e.x + Math.cos(a) * 86
          const sy2 = e.y + Math.sin(a) * 86
          if (w.spawnEnemy(EK_PLATONIST, sx2, sy2)) w.burst(sx2, sy2, 6, PC_CREAM, 100, 2.5, 0.4)
        }
        w.audio.thud(true)
      }
    } else {
      sx = dx
      sy = dy
    }

    // в стаггере от отброса враг не рулит
    const k2 = e.kx * e.kx + e.ky * e.ky
    const steer = k2 > 8100 ? 0.2 : 1
    e.x += (sx * e.speed * steer + e.kx) * dt
    e.y += (sy * e.speed * steer + e.ky) * dt
    const dec = Math.max(0, 1 - dt * 5)
    e.kx *= dec
    e.ky *= dec
    if (Math.abs(sx) > 0.05) e.facing = sx > 0 ? 1 : -1

    // отставших телепортируем обратно на кольцо — плотность не проседает.
    // Платон не бегает — идея просто оказывается ближе.
    if (e.kind === EK_PLATO) {
      if (d > 1000) {
        const a = w.rng.next() * Math.PI * 2
        e.x = p.x + Math.cos(a) * 620
        e.y = p.y + Math.sin(a) * 620
        e.kx = 0
        e.ky = 0
        w.burst(e.x, e.y, 8, PC_CREAM, 110, 2.5, 0.5)
      }
    } else if (d > 1450) {
      const a = w.rng.next() * Math.PI * 2
      e.x = p.x + Math.cos(a) * CFG.spawn.ringDist
      e.y = p.y + Math.sin(a) * CFG.spawn.ringDist
      e.kx = 0
      e.ky = 0
    }
  }
}

export function buildHash(w: World): void {
  w.hash.begin(w.player.x, w.player.y)
  for (let i = 0; i < w.enemyCount; i++) {
    const e = w.enemies[i]
    if (!e.dying) w.hash.add(i, e.x, e.y)
  }
  w.hash.build()
}

/** Мягкое расталкивание, чтобы враги не слипались в кашу. */
export function separate(w: World): void {
  const h = w.hash
  for (let i = 0; i < w.enemyCount; i++) {
    const e = w.enemies[i]
    if (e.dying) continue
    const n = h.query(e.x, e.y, 40)
    for (let k = 0; k < n; k++) {
      const j = h.out[k]
      if (j <= i) continue
      const o = w.enemies[j]
      if (o.dying) continue
      const dx = o.x - e.x
      const dy = o.y - e.y
      const d2 = dx * dx + dy * dy
      const min = (e.r + o.r) * 0.92
      if (d2 >= min * min || d2 < 0.0001) continue
      const d = Math.sqrt(d2)
      const push = ((min - d) / d) * 0.4
      const px = dx * push
      const py = dy * push
      e.x -= px
      e.y -= py
      o.x += px
      o.y += py
    }
  }
  // босс продавливает толпу
  const b = w.boss
  if (b.active && !b.dead) {
    const n = h.query(b.x, b.y, b.r + 24)
    for (let k = 0; k < n; k++) {
      const o = w.enemies[h.out[k]]
      if (o.dying) continue
      const dx = o.x - b.x
      const dy = o.y - b.y
      const d = Math.hypot(dx, dy) || 0.001
      const min = b.r + o.r
      if (d < min) {
        o.x += (dx / d) * (min - d)
        o.y += (dy / d) * (min - d)
      }
    }
  }
}

/** Контактный урон по игроку. */
export function contactDamage(w: World): void {
  const p = w.player
  if (p.dead || p.invuln > 0) return
  const n = w.hash.query(p.x, p.y, p.r + 26)
  for (let k = 0; k < n; k++) {
    const e = w.enemies[w.hash.out[k]]
    if (e.dying) continue
    const dx = e.x - p.x
    const dy = e.y - p.y
    const rr = e.r + p.r
    if (dx * dx + dy * dy < rr * rr) {
      w.damagePlayer(e.dmg)
      break
    }
  }
}

/** Уплотнение пула: убираем помеченных как dying. Вызывать в конце тика. */
export function sweepDead(w: World): void {
  for (let i = w.enemyCount - 1; i >= 0; i--) {
    if (!w.enemies[i].dying) continue
    w.enemyCount--
    if (i !== w.enemyCount) {
      const tmp = w.enemies[i]
      w.enemies[i] = w.enemies[w.enemyCount]
      w.enemies[w.enemyCount] = tmp
    }
  }
}

// Бот для авто-плейтеста (?bot=1): держит врагов на «рабочей» дистанции фонаря,
// уворачивается от свитков и рывков Александра, подбирает оливки,
// апгрейды берёт случайно (через w.rng — детерминированно при ?seed=).

import type { World } from './world'

const FLEE_R = 100      // ближе — отбегаем
const ENGAGE_R = 150    // дальше — подходим, чтобы фонарь доставал
const BOSS_NEAR = 85
const BOSS_FAR = 125

const SECTORS = 12
const SECTOR_R = 300

export class Bot {
  mx = 0
  my = 0
  dash = false
  /** Тиков до случайного выбора на экране апгрейда. */
  pickDelay = 0
  private orbitDir = 1
  private orbitT = 0
  private wanderA = 0
  private wanderT = 0
  private readonly density = new Float64Array(SECTORS)

  reset(): void {
    this.mx = 0
    this.my = 0
    this.dash = false
    this.pickDelay = 0
    this.orbitDir = 1
    this.orbitT = 0
    this.wanderA = 0
    this.wanderT = 0
  }

  update(w: World, dt: number): void {
    const p = w.player
    let fx = 0
    let fy = 0
    let urgent = 0
    let nearD = 1e9
    let nearX = 0
    let nearY = 0

    // периодически меняем сторону кружения, чтобы не зажимали
    this.orbitT -= dt
    if (this.orbitT <= 0) {
      this.orbitT = 2.5 + w.rng.next() * 2
      this.orbitDir = w.rng.next() < 0.5 ? -1 : 1
    }

    this.density.fill(0)
    for (let i = 0; i < w.enemyCount; i++) {
      const e = w.enemies[i]
      if (e.dying) continue
      const dx = p.x - e.x
      const dy = p.y - e.y
      const d = Math.hypot(dx, dy) || 0.001
      if (d < nearD) { nearD = d; nearX = e.x; nearY = e.y }
      if (d < SECTOR_R) {
        // плотность угроз по направлениям — для поиска бреши
        const a = Math.atan2(e.y - p.y, e.x - p.x)
        const si = ((Math.floor((a / (Math.PI * 2)) * SECTORS) % SECTORS) + SECTORS) % SECTORS
        this.density[si] += (1 - d / SECTOR_R) * (1 - d / SECTOR_R)
      }
      if (d < FLEE_R) {
        const wgt = ((FLEE_R - d) / FLEE_R) * 2.2
        fx += (dx / d) * wgt
        fy += (dy / d) * wgt
        urgent += wgt
      }
    }

    // вражеские свитки: уворот от точки сближения
    for (let i = 0; i < w.projCount; i++) {
      const pr = w.projs[i]
      if (!pr.hostile) continue
      const rx = p.x - pr.x
      const ry = p.y - pr.y
      const v2 = pr.vx * pr.vx + pr.vy * pr.vy
      if (v2 < 1) continue
      const tt = Math.max(0, Math.min(1.2, (rx * pr.vx + ry * pr.vy) / v2))
      const cx = rx - pr.vx * tt
      const cy = ry - pr.vy * tt
      const cd = Math.hypot(cx, cy) || 0.001
      if (cd < 80) {
        const wgt = (1 - cd / 80) * 2.6
        fx += (cx / cd) * wgt
        fy += (cy / cd) * wgt
        urgent += wgt
      }
    }

    const b = w.boss
    let bossBand = false
    if (b.active && !b.dead) {
      const dx = p.x - b.x
      const dy = p.y - b.y
      const d = Math.hypot(dx, dy) || 0.001
      if (b.phase === 1 || b.phase === 2) {
        // выйти из полосы телеграфа/рывка перпендикуляром
        const along = -dx * b.dx + -dy * b.dy
        const lat = -dx * -b.dy + -dy * b.dx
        if (along > -60 && along < b.dashFull + 140 && Math.abs(lat) < 150) {
          const sgn = lat >= 0 ? 1 : -1
          fx += -b.dy * sgn * 5
          fy += b.dx * sgn * 5
          urgent += 5
        }
      } else if (d < BOSS_NEAR) {
        const wgt = ((BOSS_NEAR - d) / BOSS_NEAR) * 3
        fx += (dx / d) * wgt
        fy += (dy / d) * wgt
        urgent += wgt
      } else if (d < 600) {
        // держим Александра на дистанции фонаря и кружим
        bossBand = true
        const want = (BOSS_NEAR + BOSS_FAR) / 2
        const pull = Math.max(-1, Math.min(1, (d - want) / 60))
        fx += (-dx / d) * pull * 1.1
        fy += (-dy / d) * pull * 1.1
        fx += (-dy / d) * this.orbitDir * 0.9
        fy += (dx / d) * this.orbitDir * 0.9
      }
    }

    if (urgent < 0.6 && !bossBand) {
      if (nearD < 9e8) {
        // боевая дистанция к ближайшему врагу: фонарь должен доставать
        const dx = nearX - p.x
        const dy = nearY - p.y
        const d = Math.hypot(dx, dy) || 0.001
        if (nearD > ENGAGE_R) {
          fx += (dx / d) * 0.9
          fy += (dy / d) * 0.9
        } else if (nearD < FLEE_R + 12) {
          fx -= (dx / d) * 0.7
          fy -= (dy / d) * 0.7
        }
        // кружим вокруг толпы
        fx += (-dy / d) * this.orbitDir * 0.85
        fy += (dx / d) * this.orbitDir * 0.85
      } else {
        // пусто: бродим
        this.wanderT -= dt
        if (this.wanderT <= 0) {
          this.wanderT = 1.5
          this.wanderA = w.rng.next() * Math.PI * 2
        }
        fx += Math.cos(this.wanderA) * 0.6
        fy += Math.sin(this.wanderA) * 0.6
      }
    }

    // оливки — приоритет, когда не горит: уровень = выживание
    // (на издыхании жадность умеряем)
    const greedCap = p.hp < p.maxHp * 0.35 ? 0.5 : 1.2
    if (urgent < greedCap) {
      let gd = 460 * 460
      let gx = 0
      let gy = 0
      let found = false
      for (let i = 0; i < w.gemCount; i++) {
        const g = w.gems[i]
        const dx = g.x - p.x
        const dy = g.y - p.y
        const d2 = dx * dx + dy * dy
        if (d2 < gd) { gd = d2; gx = dx; gy = dy; found = true }
      }
      if (found) {
        const d = Math.sqrt(gd) || 1
        const wgt = Math.min(2.4, (greedCap - urgent) * 2.4)
        fx += (gx / d) * wgt
        fy += (gy / d) * wgt
      }
    }

    // направление наименьшей плотности (окно из трёх секторов — брешь должна быть проходимой)
    let best = 0
    let bestV = Infinity
    for (let s = 0; s < SECTORS; s++) {
      const v = this.density[s] +
        0.6 * (this.density[(s + 1) % SECTORS] + this.density[(s + SECTORS - 1) % SECTORS])
      if (v < bestV) { bestV = v; best = s }
    }
    const gapA = ((best + 0.5) / SECTORS) * Math.PI * 2
    const fleeLen = Math.hypot(fx, fy)
    const surrounded = urgent > 1.8 && fleeLen < urgent * 0.5
    if (surrounded) {
      // векторы бегства гасят друг друга — ломимся в брешь, остальное вторично
      fx += Math.cos(gapA) * (2 + urgent)
      fy += Math.sin(gapA) * (2 + urgent)
    } else {
      // и в спокойном режиме дрейфуем к разреженной стороне
      fx += Math.cos(gapA) * 0.5
      fy += Math.sin(gapA) * 0.5
    }

    const l = Math.hypot(fx, fy)
    if (l > 0.001) {
      this.mx = fx / l
      this.my = fy / l
    } else {
      this.mx = 0
      this.my = 0
    }

    // рывок: заряжен и прижали (или пора протаранить толпу)
    this.dash = w.weapons.barrel > 0 && p.charge >= 1 && (nearD < 80 || urgent > 3 || surrounded)
  }
}

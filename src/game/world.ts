import { CFG, CHARS, ENEMY_DEF, EK_PLATO, EK_PLATONIST, PC_INK, PC_CREAM, PC_OLIVE, PC_BLOOD, PC_OCHRE, type CharDef } from '../config'
import type { AudioSys } from '../engine/audio'
import { RNG } from '../engine/rng'
import { SpatialHash } from '../engine/shash'
import type { Boss, DmgNum, Dog, Enemy, Floater, Gem, Particle, Proj } from './types'

export interface PlayerState {
  x: number
  y: number
  vx: number
  vy: number
  hp: number
  maxHp: number
  r: number
  invuln: number
  facing: number
  dist: number      // пройденный путь — для вращения бочки
  charge: number    // заряд рывка 0..1
  dashT: number
  dashX: number
  dashY: number
  dead: boolean
}

// Вся изменяемая часть рана. Пулы аллоцируются один раз в конструкторе,
// reset() только переинициализирует поля — рестарт без перезагрузки страницы.
export class World {
  rng: RNG = new RNG(1)
  /** Отдельный поток случайности для чисто визуальных эффектов — не трогает детерминизм логики. */
  fxr: RNG = new RNG((Date.now() & 0xffffff) | 1)
  audio: AudioSys

  t = 0
  kills = 0
  level = 1
  xp = 0
  xpNeed = CFG.xpNeed(1)
  pendingLevels = 0
  hitstop = 0
  trauma = 0
  endTimer = -1
  endState = 0 // 1 — смерть, 2 — победа

  player: PlayerState = {
    x: 0, y: 0, vx: 0, vy: 0, hp: 100, maxHp: 100, r: CFG.player.r,
    invuln: 0, facing: 1, dist: 0, charge: 0, dashT: 0, dashX: 1, dashY: 0, dead: false,
  }

  // Уровни оружия (0 — не открыто) и пассивок.
  weapons = { lantern: 1, spit: 0, dogs: 0, barrel: 0 }
  pass = { dmg: 0, aspd: 0, area: 0, mspd: 0, magnet: 0, hp: 0, dog: 0, pierce: 0, ask: 0, soup: 0 }
  /** Эволюции: солнце (фонарь), свора (псы), диатриба (плевок), пифос (бочка). */
  sun = false
  evoPack = false
  evoFan = false
  evoPithos = false
  miniSpawned = false
  /** Слоу-мо (секунды реального времени) — выход и смерть босса. */
  slowmo = 0
  /** Мета-бонусы из лавки (уровни 0..5). Выставляется Game до reset(). */
  meta = { hp: 0, dmg: 0, spd: 0, mag: 0 }
  /** Выбранный персонаж. Выставляется Game до reset(). */
  chr: CharDef = CHARS[0]

  lanternAngle = 0
  lanternTick = 0
  lanternPulse = 0
  spitTick = 0

  dogs: Dog[] = []
  dogCount = 0

  enemies: Enemy[] = []
  enemyCount = 0
  nextUid = 1

  projs: Proj[] = []
  projCount = 0

  gems: Gem[] = []
  gemCount = 0

  parts: Particle[] = []
  partCount = 0

  nums: DmgNum[] = []
  numCount = 0

  floaters: Floater[] = []

  caption = ''
  captionT = 0

  boss: Boss = {
    active: false, dead: false, x: 0, y: 0, r: CFG.boss.r, hp: 0, maxHp: 1,
    phase: 0, pt: 0, dx: 1, dy: 0, dashLeft: 0, dashFull: 1, hitThisDash: false,
    summonCd: 0, touchCd: 0, dogCd: 0, flash: 0, facing: 1,
  }
  bossSpawned = false
  bossDashes = 0
  bossSummons = 0
  lanternProcs = 0
  /** Отладочная подмена HP босса (?bosshp=) — для теста экрана победы. */
  bossHpOverride: number | null = null

  spawnAcc = 0
  burstIdx = 0

  hash: SpatialHash

  constructor(audio: AudioSys) {
    this.audio = audio
    this.hash = new SpatialHash(44, 64, 64, CFG.caps.enemies)
    for (let i = 0; i < CFG.caps.enemies; i++) {
      this.enemies.push({
        uid: 0, kind: 0, x: 0, y: 0, hp: 1, maxHp: 1, r: 10, speed: 0, dmg: 0, xp: 1,
        kx: 0, ky: 0, flash: 0, dying: false, facing: 1, seed: 0, fire: 0, ramCd: 0, dogCd: 0, elite: false,
      })
    }
    for (let i = 0; i < CFG.caps.projs; i++) {
      this.projs.push({ x: 0, y: 0, vx: 0, vy: 0, r: 4, dmg: 0, pierce: 0, life: 0, hostile: false, lastUid: 0 })
    }
    for (let i = 0; i < CFG.caps.gems; i++) this.gems.push({ x: 0, y: 0, v: 1, t: 0, pull: 0 })
    for (let i = 0; i < CFG.caps.parts; i++) {
      this.parts.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, col: 0, drag: 0 })
    }
    for (let i = 0; i < CFG.caps.nums; i++) this.nums.push({ x: 0, y: 0, v: 0, t: 0, big: false })
    for (let i = 0; i < 12; i++) this.dogs.push({ x: 0, y: 0, state: 0, tUid: 0, tIdx: -1, timer: 0, facing: 1, seed: i / 12 })
    for (let i = 0; i < 8; i++) this.floaters.push({ x: 0, y: 0, t: 0, text: '' })
  }

  reset(seed: number): void {
    this.rng = new RNG(seed)
    this.t = 0
    this.kills = 0
    this.level = 1
    this.xp = 0
    this.xpNeed = CFG.xpNeed(1)
    this.pendingLevels = 0
    this.hitstop = 0
    this.trauma = 0
    this.endTimer = -1
    this.endState = 0
    const p = this.player
    p.x = 0; p.y = 0; p.vx = 0; p.vy = 0
    p.maxHp = this.chr.hp + this.meta.hp * 8
    p.hp = p.maxHp
    p.invuln = 0; p.facing = 1; p.dist = 0
    // у безбочковых уворот заряжен со старта
    p.charge = this.chr.barrel ? 0 : 1
    p.dashT = 0; p.dashX = 1; p.dashY = 0; p.dead = false
    this.weapons.lantern = this.chr.start === 'lantern' ? 1 : 0
    this.weapons.spit = this.chr.start === 'spit' ? 1 : 0
    this.weapons.dogs = 0
    this.weapons.barrel = 0
    const ps = this.pass
    ps.dmg = 0; ps.aspd = 0; ps.area = 0; ps.mspd = 0; ps.magnet = 0
    ps.hp = 0; ps.dog = 0; ps.pierce = 0; ps.ask = 0; ps.soup = 0
    this.sun = false
    this.evoPack = false
    this.evoFan = false
    this.evoPithos = false
    this.miniSpawned = false
    this.slowmo = 0
    this.lanternAngle = 0
    this.lanternTick = 0.3
    this.lanternPulse = 0
    this.spitTick = 0
    this.dogCount = 0
    this.enemyCount = 0
    this.nextUid = 1
    this.projCount = 0
    this.gemCount = 0
    this.partCount = 0
    this.numCount = 0
    for (let i = 0; i < this.floaters.length; i++) this.floaters[i].t = 0
    this.caption = ''
    this.captionT = 0
    const b = this.boss
    b.active = false; b.dead = false; b.hp = 0; b.maxHp = 1
    b.phase = 0; b.pt = 0; b.dashLeft = 0; b.hitThisDash = false
    b.summonCd = 0; b.touchCd = 0; b.dogCd = 0; b.flash = 0
    this.bossSpawned = false
    this.bossDashes = 0
    this.bossSummons = 0
    this.lanternProcs = 0
    this.spawnAcc = 0
    this.burstIdx = 0
  }

  // ---- производные характеристики ----

  dmgMult(): number {
    return (1 + 0.2 * this.pass.dmg) * (1 + 0.35 * this.pass.ask) * (1 + 0.04 * this.meta.dmg)
  }

  /** Множитель интервалов атак (меньше — быстрее). */
  intMult(): number {
    return 1 / (1 + 0.15 * this.pass.aspd)
  }

  areaMult(): number {
    return 1 + 0.15 * this.pass.area
  }

  moveSpeed(): number {
    return this.chr.speed * (1 + 0.1 * this.pass.mspd) * (1 + 0.03 * this.meta.spd)
  }

  magnetR(): number {
    return CFG.player.magnet * (1 + 0.25 * this.pass.magnet) * (1 + 0.08 * this.meta.mag)
  }

  // ---- спавны/события ----

  spawnEnemy(kind: number, x: number, y: number): Enemy | null {
    if (this.enemyCount >= this.enemies.length) return null
    const def = ENEMY_DEF[kind]
    const e = this.enemies[this.enemyCount++]
    e.uid = this.nextUid++
    e.kind = kind
    e.x = x; e.y = y
    e.maxHp = Math.round(def.hp * CFG.hpScale(this.t))
    e.hp = e.maxHp
    e.r = def.r
    e.speed = def.speed * (0.92 + 0.16 * this.rng.next())
    e.dmg = def.dmg
    e.xp = def.xp
    e.kx = 0; e.ky = 0
    e.flash = 0
    e.dying = false
    e.facing = 1
    e.seed = this.rng.next()
    e.fire = 1 + e.seed * CFG.sophist.fireCd
    e.ramCd = 0
    e.dogCd = 0
    e.elite = false
    return e
  }

  spawnProj(x: number, y: number, vx: number, vy: number, r: number, dmg: number, pierce: number, life: number, hostile: boolean): void {
    if (this.projCount >= this.projs.length) return
    const p = this.projs[this.projCount++]
    p.x = x; p.y = y; p.vx = vx; p.vy = vy
    p.r = r; p.dmg = dmg; p.pierce = pierce; p.life = life
    p.hostile = hostile
    p.lastUid = 0
  }

  removeProj(i: number): void {
    this.projCount--
    if (i !== this.projCount) {
      const tmp = this.projs[i]
      this.projs[i] = this.projs[this.projCount]
      this.projs[this.projCount] = tmp
    }
  }

  spawnGem(x: number, y: number, v: number): void {
    if (this.gemCount >= this.gems.length) {
      // пул полон — вливаем ценность в случайную живую оливку
      this.gems[this.rng.int(this.gemCount)].v += v
      return
    }
    const g = this.gems[this.gemCount++]
    g.x = x; g.y = y; g.v = v; g.t = this.fxr.next() * 6; g.pull = 0
  }

  removeGem(i: number): void {
    this.gemCount--
    if (i !== this.gemCount) {
      const tmp = this.gems[i]
      this.gems[i] = this.gems[this.gemCount]
      this.gems[this.gemCount] = tmp
    }
  }

  spawnPart(x: number, y: number, vx: number, vy: number, life: number, size: number, col: number, drag = 3): void {
    if (this.partCount >= this.parts.length) return
    const p = this.parts[this.partCount++]
    p.x = x; p.y = y; p.vx = vx; p.vy = vy
    p.life = life; p.max = life; p.size = size; p.col = col; p.drag = drag
  }

  burst(x: number, y: number, n: number, col: number, speed: number, size: number, life = 0.5): void {
    for (let i = 0; i < n; i++) {
      const a = this.fxr.next() * Math.PI * 2
      const s = speed * (0.4 + this.fxr.next() * 0.8)
      this.spawnPart(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + this.fxr.next() * 0.8), size * (0.7 + this.fxr.next() * 0.6), col)
    }
  }

  spawnNum(x: number, y: number, v: number, big: boolean): void {
    if (this.numCount >= this.nums.length) return
    const n = this.nums[this.numCount++]
    n.x = x + (this.fxr.next() - 0.5) * 10
    n.y = y
    n.v = Math.max(1, Math.round(v))
    n.t = 0
    n.big = big
  }

  floatText(x: number, y: number, text: string): void {
    let slot = this.floaters[0]
    for (let i = 0; i < this.floaters.length; i++) {
      if (this.floaters[i].t <= 0) { slot = this.floaters[i]; break }
    }
    slot.x = x; slot.y = y; slot.t = 2.6; slot.text = text
  }

  setCaption(text: string, dur: number): void {
    this.caption = text
    this.captionT = dur
  }

  addTrauma(v: number): void {
    this.trauma = Math.min(1, this.trauma + v)
  }

  addHitstop(v: number): void {
    this.hitstop = Math.min(0.1, this.hitstop + v)
  }

  // ---- урон ----

  damageEnemy(i: number, dmg: number, sx: number, sy: number, kb: number, big = false): void {
    const e = this.enemies[i]
    if (e.dying) return
    e.hp -= dmg
    e.flash = 0.09
    this.spawnNum(e.x, e.y - e.r - 4, dmg, big)
    if (kb > 0) {
      let dx = e.x - sx
      let dy = e.y - sy
      const d = Math.hypot(dx, dy)
      if (d > 0.001) { dx /= d; dy /= d } else { dx = 1; dy = 0 }
      e.kx += dx * kb
      e.ky += dy * kb
    }
    this.audio.thud(false)
    if (e.hp <= 0) this.killEnemy(i, true)
  }

  killEnemy(i: number, dropGem: boolean): void {
    const e = this.enemies[i]
    if (e.dying) return
    e.dying = true
    if (dropGem) {
      this.kills++
      if (e.kind === EK_PLATO) {
        // сам Платон: сноп оливок кольцом и реверанс
        for (let k = 0; k < CFG.mini.gems; k++) {
          const a = (k / CFG.mini.gems) * Math.PI * 2
          this.spawnGem(e.x + Math.cos(a) * 56, e.y + Math.sin(a) * 56, 1)
        }
        this.setCaption('ИДЕЯ ПЛАТОНА ОКАЗАЛАСЬ СМЕРТНОЙ', 3)
        this.addTrauma(0.45)
        this.addHitstop(0.06)
        this.burst(e.x, e.y, 22, PC_INK, 190, 3.5, 0.7)
        this.burst(e.x, e.y, 10, PC_OCHRE, 150, 2.5, 0.6)
        this.audio.boom()
        return
      }
      // оливка катится чуть в сторону бочки — магниту проще дотянуться
      const gx = e.x + (this.player.x - e.x) * 0.3
      const gy = e.y + (this.player.y - e.y) * 0.3
      this.spawnGem(gx, gy, e.xp)
      const fat = e.kind === EK_PLATONIST
      this.addHitstop(fat ? 0.05 : 0.032)
      if (fat) this.addTrauma(0.22)
      this.burst(e.x, e.y, fat ? 12 : 7, PC_INK, fat ? 160 : 110, 3, 0.55)
      this.burst(e.x, e.y, 3, PC_CREAM, 90, 2, 0.4)
      this.burst(e.x, e.y, 2, PC_BLOOD, 70, 2.5, 0.5)
      this.audio.thud(fat)
    } else {
      this.burst(e.x, e.y, 5, PC_INK, 120, 2.5, 0.4)
    }
  }

  damageBoss(dmg: number, fromLantern: boolean): void {
    const b = this.boss
    if (!b.active || b.dead) return
    b.hp -= dmg
    b.flash = 0.09
    this.spawnNum(b.x + (this.fxr.next() - 0.5) * 24, b.y - b.r - 6, dmg, fromLantern)
    this.audio.thud(false)
  }

  damagePlayer(dmg: number): void {
    const p = this.player
    if (p.dead || p.invuln > 0) return
    p.hp -= dmg
    p.invuln = CFG.player.iframes
    this.addTrauma(0.42)
    this.burst(p.x, p.y, 8, PC_BLOOD, 130, 2.5, 0.5)
    this.audio.hurt()
    if (p.hp <= 0) {
      p.hp = 0
      p.dead = true
      this.burst(p.x, p.y, 26, PC_INK, 200, 3.5, 0.9)
      this.burst(p.x, p.y, 10, PC_CREAM, 150, 2.5, 0.7)
      this.addTrauma(1)
      this.audio.boom()
      this.audio.stinger(false)
      this.audio.drone(false)
      this.endTimer = 1.2
      this.endState = 1
    }
  }

  addXp(v: number): void {
    this.xp += v
    this.burst(this.player.x, this.player.y - 14, 1, PC_OLIVE, 50, 2, 0.3)
    while (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed
      this.level++
      this.pendingLevels++
      this.xpNeed = CFG.xpNeed(this.level)
    }
  }
}

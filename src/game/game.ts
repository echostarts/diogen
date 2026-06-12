import { CFG, CHARS, EK_GUARD, EK_MERCHANT, EK_PLATONIST, EK_SOPHIST, VIEW_H, VIEW_W } from '../config'
import type { AudioSys } from '../engine/audio'
import type { Input } from '../engine/input'
import { Bot } from './bot'
import { maybeSpawnBoss, updateBoss } from './boss'
import { buildHash, contactDamage, separate, spawnerTick, sweepDead, updateEnemies } from './enemies'
import { updateFx } from './fx'
import { Hud } from './hud'
import { updateGems } from './pickups'
import { updatePlayer } from './player'
import { drawWorld } from './render'
import { drawEnd, drawLevelup, drawPause, drawShop, drawShopButton, drawTitle, type ShopRow } from './screens'
import { buildSprites, type Sprites } from './sprites'
import { defByIndex, roman, rollChoices, UPGRADES } from './upgrades'
import { updateWeapons } from './weapons'
import { World } from './world'

export type GState = 'title' | 'run' | 'levelup' | 'pause' | 'over' | 'win' | 'shop'

// Эволюции получают фанфару вместо обычного клика выбора карты.
const EVO_IDS = new Set(['w_sun', 'e_pack', 'e_fan', 'e_pithos'])

// Товары лавки: ключ в Meta, название, описание.
const SHOP_ITEMS = [
  { key: 'hp' as const, name: 'ТОЛСТЫЕ ДОСКИ', desc: '+8 к максимуму HP за уровень' },
  { key: 'dmg' as const, name: 'НАКОПЛЕННАЯ ЖЕЛЧЬ', desc: '+4% урона за уровень' },
  { key: 'spd' as const, name: 'СМАЗАННЫЕ ОБОДЬЯ', desc: '+3% скорости за уровень' },
  { key: 'mag' as const, name: 'ШИРОКАЯ ЧАША', desc: '+8% радиуса подбора за уровень' },
]

interface Meta {
  w: number
  hp: number
  dmg: number
  spd: number
  mag: number
  /** Открытые герои: битовая маска по индексам CHARS (бит 0 всегда есть). */
  chars: number
}

// Красная кромка при низком HP — рендерится один раз.
let redVignette: HTMLCanvasElement | null = null
function getRedVignette(): HTMLCanvasElement {
  if (!redVignette) {
    redVignette = document.createElement('canvas')
    redVignette.width = VIEW_W
    redVignette.height = VIEW_H
    const c = redVignette.getContext('2d')!
    const g = c.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.34, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.78)
    g.addColorStop(0, 'rgba(126, 24, 12, 0)')
    g.addColorStop(1, 'rgba(126, 24, 12, 0.55)')
    c.fillStyle = g
    c.fillRect(0, 0, VIEW_W, VIEW_H)
  }
  return redVignette
}

export interface GameOpts {
  bot: boolean
  stress: boolean
  seed: number | null
  bossHpOverride: number | null
  /** Форсировать героя (?char=, для отладки и ботовых прогонов). */
  charOverride: number | null
}

export class Game {
  readonly world: World
  readonly input: Input
  readonly audio: AudioSys
  readonly hud = new Hud()
  readonly bot: Bot | null
  sprites: Sprites | null = null
  state: GState = 'title'
  choices = [-1, -1, -1]
  sel = 0
  statLines: string[] = []
  uiT = 0
  god = false
  /** Тач-устройство: меняет подсказки и показывает экранные кнопки. */
  coarse = false
  /** Состояние виртуального стика — пишет main.ts, рисует HUD. */
  stick = { active: false, ox: 0, oy: 0, dx: 0, dy: 0 }
  meta: Meta = { w: 0, hp: 0, dmg: 0, spd: 0, mag: 0, chars: 1 }
  charId = 0
  shopSel = 0
  pauseSel = 0
  private readonly shopRowsBuf: ShopRow[] = []
  private heartT = 0
  private bestLine: string | null = null
  private readonly opts: GameOpts

  constructor(input: Input, audio: AudioSys, opts: GameOpts) {
    this.input = input
    this.audio = audio
    this.opts = opts
    this.world = new World(audio)
    this.loadMeta()
    if (opts.charOverride !== null && CHARS[opts.charOverride]) {
      this.charId = opts.charOverride
    }
    this.syncMeta()
    this.world.chr = CHARS[this.charId]
    this.world.reset(this.pickSeed())
    this.bot = opts.bot ? new Bot() : null
    this.god = opts.stress
    this.loadBest()
  }

  // --- лавка: кошелёк и постоянные бонусы (localStorage) ---

  private loadMeta(): void {
    try {
      const raw = localStorage.getItem('diogen_meta')
      if (raw) {
        const m = JSON.parse(raw) as Partial<Meta>
        this.meta.w = m.w ?? 0
        this.meta.hp = m.hp ?? 0
        this.meta.dmg = m.dmg ?? 0
        this.meta.spd = m.spd ?? 0
        this.meta.mag = m.mag ?? 0
        this.meta.chars = (m.chars ?? 1) | 1
      }
      const c = Number(localStorage.getItem('diogen_char') ?? '0')
      if (CHARS[c] && this.charUnlocked(c)) this.charId = c
    } catch { /* начнём с нуля */ }
  }

  charUnlocked(i: number): boolean {
    return (this.meta.chars & (1 << i)) !== 0
  }

  /** Сменить героя на тайтле (dir = ±1). */
  cycleChar(dir: number): void {
    this.charId = (this.charId + dir + CHARS.length) % CHARS.length
    try { localStorage.setItem('diogen_char', String(this.charId)) } catch { /* ок */ }
    this.audio.ui()
  }

  /** ENTER/тап на тайтле: либо старт, либо выкуп выбранного героя. */
  confirmTitle(): void {
    if (this.charUnlocked(this.charId)) {
      this.startRun()
      return
    }
    const cost = CHARS[this.charId].cost
    if (this.meta.w >= cost) {
      this.meta.w -= cost
      this.meta.chars |= 1 << this.charId
      this.saveMeta()
      this.audio.levelup()
    } else {
      this.audio.thud(false)
    }
  }

  private saveMeta(): void {
    try { localStorage.setItem('diogen_meta', JSON.stringify(this.meta)) } catch { /* ок */ }
  }

  private syncMeta(): void {
    this.world.meta.hp = this.meta.hp
    this.world.meta.dmg = this.meta.dmg
    this.world.meta.spd = this.meta.spd
    this.world.meta.mag = this.meta.mag
  }

  shopCost(lvl: number): number {
    return CFG.meta.costBase + CFG.meta.costStep * lvl
  }

  /** Покупка строки i (клавиши и тап). */
  shopBuy(i: number): void {
    this.shopSel = i
    const item = SHOP_ITEMS[i]
    if (!item) return
    const lvl = this.meta[item.key]
    if (lvl >= CFG.meta.max) return
    const cost = this.shopCost(lvl)
    if (this.meta.w < cost) {
      this.audio.thud(false)
      return
    }
    this.meta.w -= cost
    this.meta[item.key]++
    this.saveMeta()
    this.audio.levelup()
  }

  shopRows(out: ShopRow[]): void {
    out.length = 0
    for (let i = 0; i < SHOP_ITEMS.length; i++) {
      const it = SHOP_ITEMS[i]
      const lvl = this.meta[it.key]
      out.push({
        name: it.name,
        desc: it.desc,
        lvl,
        max: CFG.meta.max,
        cost: lvl >= CFG.meta.max ? -1 : this.shopCost(lvl),
      })
    }
  }

  // --- лучший ран (localStorage) ---

  private loadBest(): void {
    try {
      const raw = localStorage.getItem('diogen_best')
      if (!raw) return
      const b = JSON.parse(raw) as { win: boolean; time: number; kills: number }
      this.bestLine = this.formatBest(b)
    } catch { /* нет — и не надо */ }
  }

  private formatBest(b: { win: boolean; time: number; kills: number }): string {
    const sec = Math.floor(b.time)
    const t = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')
    return (b.win ? 'ЛУЧШИЙ ЗАХОД: ПОБЕДА ЗА ' : 'ЛУЧШИЙ ЗАХОД: ') + t + ' · ПЕРЕУБЕЖДЕНО ' + b.kills
  }

  private saveBest(win: boolean): void {
    if (this.bot) return // достижения ботов не считаются
    const cur = { win, time: this.world.t, kills: this.world.kills }
    try {
      const raw = localStorage.getItem('diogen_best')
      if (raw) {
        const old = JSON.parse(raw) as { win: boolean; time: number; kills: number }
        // победа важнее поражения; среди побед — быстрее, среди поражений — дольше
        const better = cur.win !== old.win ? cur.win : cur.win ? cur.time < old.time : cur.time > old.time
        if (!better) return
      }
      localStorage.setItem('diogen_best', JSON.stringify(cur))
      this.bestLine = this.formatBest(cur)
    } catch { /* приватный режим */ }
  }

  private pickSeed(): number {
    return this.opts.seed !== null ? this.opts.seed : ((Date.now() ^ (Math.random() * 0xffffff)) & 0x7fffffff)
  }

  startRun(): void {
    this.syncMeta()
    this.world.chr = CHARS[this.charId]
    this.world.reset(this.pickSeed())
    this.world.bossHpOverride = this.opts.bossHpOverride
    this.bot?.reset()
    this.state = 'run'
    if (this.opts.stress) this.setupStress()
    this.audio.ui()
    this.audio.duckMusic(false)
  }

  private setupStress(): void {
    const w = this.world
    const kinds = [EK_MERCHANT, EK_GUARD, EK_PLATONIST, EK_SOPHIST]
    for (let i = 0; i < 300; i++) {
      const a = w.rng.next() * Math.PI * 2
      const d = 220 + w.rng.next() * 540
      w.spawnEnemy(kinds[i & 3], Math.cos(a) * d, Math.sin(a) * d)
    }
    // и все четыре оружия на максимум — пусть молотит
    w.weapons.lantern = 5
    w.weapons.spit = 5
    w.weapons.dogs = 5
    w.weapons.barrel = 5
    w.pass.aspd = 5
  }

  /** Один фиксированный шаг логики. */
  tick(dt: number): void {
    const inp = this.input
    inp.poll()
    this.uiT += dt
    if (inp.wasPressed('mute')) this.audio.toggleMute()

    switch (this.state) {
      case 'title': {
        if (this.bot) {
          this.startRun()
        } else if (inp.wasPressed('confirm')) {
          this.confirmTitle()
        } else if (inp.wasPressed('left')) {
          this.cycleChar(-1)
        } else if (inp.wasPressed('right')) {
          this.cycleChar(1)
        } else if (inp.wasPressed('shop')) {
          this.state = 'shop'
          this.shopSel = 0
          this.audio.ui()
        }
        break
      }
      case 'shop': {
        if (inp.wasPressed('up')) { this.shopSel = (this.shopSel + SHOP_ITEMS.length - 1) % SHOP_ITEMS.length; this.audio.ui() }
        if (inp.wasPressed('down')) { this.shopSel = (this.shopSel + 1) % SHOP_ITEMS.length; this.audio.ui() }
        if (inp.wasPressed('confirm')) this.shopBuy(this.shopSel)
        if (inp.wasPressed('pause') || inp.wasPressed('shop')) {
          this.state = 'title'
          this.audio.ui()
        }
        break
      }
      case 'run': {
        if (inp.wasPressed('pause')) {
          this.state = 'pause'
          this.pauseSel = 0
          this.buildStats(true)
          this.audio.ui()
          this.audio.duckMusic(true)
          break
        }
        let mx = inp.moveX
        let my = inp.moveY
        let dash = inp.wasPressed('dash')
        if (this.bot) {
          this.bot.update(this.world, dt)
          mx = this.bot.mx
          my = this.bot.my
          dash = this.bot.dash
        }
        this.worldTick(dt, mx, my, dash)
        // музыка: интенсивность растёт к финалу, у босса — мрачнеет;
        // после развязки (endState ≠ 0) не дёргаем — там финальный джингл
        const wb = this.world
        if (wb.endState === 0) {
          this.audio.musicTick(wb.boss.active && !wb.boss.dead ? 3 : wb.t > 150 ? 2 : 1)
        }
        const w = this.world
        // сердцебиение на издыхании
        this.heartT -= dt
        if (!w.player.dead && w.player.hp < w.player.maxHp * 0.3 && this.heartT <= 0) {
          this.heartT = 0.95
          this.audio.heart()
        }
        if (w.endState > 0 && w.endTimer <= 0) {
          this.state = w.endState === 2 ? 'win' : 'over'
          this.buildStats(false)
          this.saveBest(w.endState === 2)
          this.awardShards(w.endState === 2)
        } else if (w.endState === 0 && w.pendingLevels > 0) {
          this.openLevelup()
        }
        break
      }
      case 'levelup': {
        if (inp.wasPressed('left')) { this.sel = (this.sel + 2) % 3; this.audio.ui() }
        if (inp.wasPressed('right')) { this.sel = (this.sel + 1) % 3; this.audio.ui() }
        if (inp.wasPressed('opt1')) this.choose(0)
        else if (inp.wasPressed('opt2')) this.choose(1)
        else if (inp.wasPressed('opt3')) this.choose(2)
        else if (inp.wasPressed('confirm')) this.choose(this.sel)
        else if (this.bot) {
          this.bot.pickDelay -= 1
          if (this.bot.pickDelay <= 0) this.choose(this.world.rng.int(3))
        }
        break
      }
      case 'pause': {
        if (inp.wasPressed('pause')) {
          this.state = 'run'
          this.audio.ui()
          this.audio.duckMusic(false)
          break
        }
        if (inp.wasPressed('up')) { this.pauseSel = (this.pauseSel + 3) % 4; this.audio.ui() }
        if (inp.wasPressed('down')) { this.pauseSel = (this.pauseSel + 1) % 4; this.audio.ui() }
        if (inp.wasPressed('confirm')) this.pauseAction(this.pauseSel)
        break
      }
      case 'over':
      case 'win': {
        if (inp.wasPressed('restart') || inp.wasPressed('confirm')) {
          this.startRun()
        } else if (inp.wasPressed('pause')) {
          this.goTitle()
        }
        break
      }
    }
    inp.endTick()
  }

  private worldTick(rdt: number, mx: number, my: number, dash: boolean): void {
    const w = this.world
    if (w.endTimer > 0) w.endTimer -= rdt
    // в стрессе убийства идут потоком — хитстоп заморозил бы время намертво
    if (this.opts.stress) w.hitstop = 0
    if (w.hitstop > 0) {
      w.hitstop -= rdt
      updateFx(w, rdt)
      return
    }
    // слоу-мо: мир течёт медленнее, реальный таймер — нет
    let dt = rdt
    if (w.slowmo > 0) {
      w.slowmo -= rdt
      dt = rdt * 0.35
    }
    w.t += dt
    if (w.endState === 0) spawnerTick(w, dt)
    updatePlayer(w, dt, mx, my, dash)
    updateEnemies(w, dt)
    maybeSpawnBoss(w)
    updateBoss(w, dt)
    buildHash(w)
    separate(w)
    if (!w.player.dead) {
      updateWeapons(w, dt)
      contactDamage(w)
      updateGems(w, dt)
    }
    updateFx(w, dt)
    sweepDead(w)
    if (this.opts.stress) this.stressTick()
  }

  private stressTick(): void {
    const w = this.world
    // бессмертие: стресс-режим меряет fps, а не живучесть
    w.player.hp = w.player.maxHp
    // и без пауз на выбор апгрейдов
    w.pendingLevels = 0
    // держим план: ~300 врагов и ≥200 частиц одновременно
    const kinds = [EK_MERCHANT, EK_GUARD, EK_PLATONIST, EK_SOPHIST]
    while (w.enemyCount < 300) {
      const a = w.rng.next() * Math.PI * 2
      const d = 300 + w.rng.next() * 460
      if (!w.spawnEnemy(kinds[w.rng.int(4)], w.player.x + Math.cos(a) * d, w.player.y + Math.sin(a) * d)) break
    }
    let guard = 0
    while (w.partCount < 220 && guard++ < 40) {
      const a = w.fxr.next() * Math.PI * 2
      const d = w.fxr.next() * 350
      w.burst(w.player.x + Math.cos(a) * d, w.player.y + Math.sin(a) * d, 5, w.fxr.int(6), 120, 2.5, 0.9)
    }
  }

  private openLevelup(): void {
    this.state = 'levelup'
    this.sel = 1
    rollChoices(this.world, this.choices)
    if (this.bot) this.bot.pickDelay = 12
    this.audio.levelup()
  }

  private choose(i: number): void {
    const w = this.world
    const def = defByIndex(this.choices[i])
    def.apply(w)
    w.pendingLevels--
    if (EVO_IDS.has(def.id)) this.audio.evolve()
    else this.audio.ui()
    if (w.pendingLevels > 0) {
      rollChoices(w, this.choices)
      this.sel = 1
      if (this.bot) this.bot.pickDelay = 12
    } else {
      this.state = 'run'
    }
  }

  /** Пункт меню паузы: 0 продолжить, 1 заново, 2 звук, 3 в меню. */
  pauseAction(i: number): void {
    this.pauseSel = i
    switch (i) {
      case 0:
        this.state = 'run'
        this.audio.ui()
        this.audio.duckMusic(false)
        break
      case 1:
        this.startRun()
        break
      case 2:
        this.audio.toggleMute()
        break
      case 3:
        this.goTitle()
        break
    }
  }

  /** Выход в главное меню (бросаем текущий ран). */
  goTitle(): void {
    this.audio.drone(false)
    this.audio.stopMusic(0.7)
    this.audio.duckMusic(false)
    this.state = 'title'
    this.audio.ui()
  }

  /** Черепки за ран: 1 за каждые 10 убеждённых + премия за победу. */
  private awardShards(win: boolean): void {
    if (this.bot) return // ботам не платят, иначе ?bot=1 — ферма черепков
    const got = Math.floor(this.world.kills / CFG.meta.killsPerShard) + (win ? CFG.meta.winBonus : 0)
    if (got <= 0) return
    this.meta.w += got
    this.saveMeta()
    if (this.statLines.length > 0) {
      this.statLines[0] += '   ·   ЧЕРЕПКИ: +' + got
    }
  }

  /** Сводка рана для паузы и финала. */
  private buildStats(forPause: boolean): void {
    const w = this.world
    const sec = Math.floor(w.t)
    const time = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')
    this.statLines = [
      'ВРЕМЯ: ' + time + '   ·   ПЕРЕУБЕЖДЕНО: ' + w.kills + '   ·   УРОВЕНЬ: ' + w.level,
      '',
    ]
    if (!forPause) this.statLines.push('СНАРЯЖЕНИЕ:')
    for (let i = 0; i < UPGRADES.length; i++) {
      const u = UPGRADES[i]
      const lvl = u.lvl(w)
      if (lvl > 0) this.statLines.push(u.name + ' ' + roman(lvl))
    }
  }

  /** Полная отрисовка кадра. s/ox/oy — letterbox-транформ в device px. */
  render(ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number, vignette: HTMLCanvasElement | null, lowQ = false): void {
    if (!this.sprites) this.sprites = buildSprites(ctx)
    drawWorld(ctx, this.world, this.sprites, s, ox, oy, lowQ)
    ctx.setTransform(s, 0, 0, s, ox, oy)
    if (vignette && !lowQ) ctx.drawImage(vignette, 0, 0, VIEW_W, VIEW_H)
    // тревожная кромка, когда здоровье на донышке
    const wp = this.world.player
    if (this.state === 'run' && !wp.dead && wp.hp < wp.maxHp * 0.3) {
      ctx.globalAlpha = 0.5 + 0.35 * Math.sin(this.uiT * 6.2)
      ctx.drawImage(getRedVignette(), 0, 0, VIEW_W, VIEW_H)
      ctx.globalAlpha = 1
    }
    if (this.state !== 'title' && this.state !== 'shop') {
      this.hud.draw(ctx, this.world, this.audio.muted, this.state === 'run' ? this.stick : null, this.coarse)
    }
    switch (this.state) {
      case 'title':
        drawTitle(
          ctx, this.uiT, this.coarse, this.bestLine,
          CHARS[this.charId], !this.charUnlocked(this.charId), this.meta.w,
        )
        drawShopButton(ctx, this.meta.w, this.coarse)
        break
      case 'shop':
        this.shopRows(this.shopRowsBuf)
        drawShop(ctx, this.shopRowsBuf, this.shopSel, this.meta.w, this.coarse)
        break
      case 'levelup':
        drawLevelup(ctx, this.world, this.choices, this.sel, this.coarse)
        break
      case 'pause':
        drawPause(ctx, this.statLines, this.pauseSel, this.audio.muted, this.coarse)
        break
      case 'over':
        drawEnd(ctx, false, this.statLines, this.uiT, this.coarse)
        break
      case 'win':
        drawEnd(ctx, true, this.statLines, this.uiT, this.coarse)
        break
      case 'run':
        break
    }
    // letterbox-поля
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    const cw = ctx.canvas.width
    const ch = ctx.canvas.height
    ctx.fillStyle = '#15100c'
    if (ox > 0) {
      ctx.fillRect(0, 0, ox, ch)
      ctx.fillRect(cw - ox, 0, ox, ch)
    }
    if (oy > 0) {
      ctx.fillRect(0, 0, cw, oy)
      ctx.fillRect(0, ch - oy, cw, oy)
    }
  }
}

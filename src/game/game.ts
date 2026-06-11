import { EK_GUARD, EK_MERCHANT, EK_PLATONIST, EK_SOPHIST, VIEW_H, VIEW_W } from '../config'
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
import { drawEnd, drawLevelup, drawPause, drawTitle } from './screens'
import { buildSprites, type Sprites } from './sprites'
import { defByIndex, roman, rollChoices, UPGRADES } from './upgrades'
import { updateWeapons } from './weapons'
import { World } from './world'

export type GState = 'title' | 'run' | 'levelup' | 'pause' | 'over' | 'win'

export interface GameOpts {
  bot: boolean
  stress: boolean
  seed: number | null
  bossHpOverride: number | null
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
  private bestLine: string | null = null
  private readonly opts: GameOpts

  constructor(input: Input, audio: AudioSys, opts: GameOpts) {
    this.input = input
    this.audio = audio
    this.opts = opts
    this.world = new World(audio)
    this.world.reset(this.pickSeed())
    this.bot = opts.bot ? new Bot() : null
    this.god = opts.stress
    this.loadBest()
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
    this.world.reset(this.pickSeed())
    this.world.bossHpOverride = this.opts.bossHpOverride
    this.bot?.reset()
    this.state = 'run'
    if (this.opts.stress) this.setupStress()
    this.audio.ui()
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
        if (this.bot || inp.wasPressed('confirm')) this.startRun()
        break
      }
      case 'run': {
        if (inp.wasPressed('pause')) {
          this.state = 'pause'
          this.buildStats(true)
          this.audio.ui()
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
        const w = this.world
        if (w.endState > 0 && w.endTimer <= 0) {
          this.state = w.endState === 2 ? 'win' : 'over'
          this.buildStats(false)
          this.saveBest(w.endState === 2)
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
        if (inp.wasPressed('pause') || inp.wasPressed('confirm')) {
          this.state = 'run'
          this.audio.ui()
        }
        break
      }
      case 'over':
      case 'win': {
        if (inp.wasPressed('restart') || inp.wasPressed('confirm')) {
          this.startRun()
        }
        break
      }
    }
    inp.endTick()
  }

  private worldTick(dt: number, mx: number, my: number, dash: boolean): void {
    const w = this.world
    if (w.endTimer > 0) w.endTimer -= dt
    // в стрессе убийства идут потоком — хитстоп заморозил бы время намертво
    if (this.opts.stress) w.hitstop = 0
    if (w.hitstop > 0) {
      w.hitstop -= dt
      updateFx(w, dt)
      return
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
    defByIndex(this.choices[i]).apply(w)
    w.pendingLevels--
    this.audio.ui()
    if (w.pendingLevels > 0) {
      rollChoices(w, this.choices)
      this.sel = 1
      if (this.bot) this.bot.pickDelay = 12
    } else {
      this.state = 'run'
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
  render(ctx: CanvasRenderingContext2D, s: number, ox: number, oy: number, vignette: HTMLCanvasElement | null): void {
    if (!this.sprites) this.sprites = buildSprites(ctx)
    drawWorld(ctx, this.world, this.sprites, s, ox, oy)
    ctx.setTransform(s, 0, 0, s, ox, oy)
    if (vignette) ctx.drawImage(vignette, 0, 0, VIEW_W, VIEW_H)
    if (this.state !== 'title') {
      this.hud.draw(ctx, this.world, this.audio.muted, this.state === 'run' ? this.stick : null, this.coarse)
    }
    switch (this.state) {
      case 'title':
        drawTitle(ctx, this.uiT, this.coarse, this.bestLine)
        break
      case 'levelup':
        drawLevelup(ctx, this.world, this.choices, this.sel, this.coarse)
        break
      case 'pause':
        drawPause(ctx, this.statLines)
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

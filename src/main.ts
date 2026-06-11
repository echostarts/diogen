import { STEP, VIEW_H, VIEW_W } from './config'
import { AudioSys } from './engine/audio'
import { Input } from './engine/input'
import { Game } from './game/game'

interface Diag {
  state: string
  time: number
  fps: number
  fps5: number
  kills: number
  level: number
  hp: number
  px: number
  py: number
  enemies: number
  parts: number
  projs: number
  gems: number
  bossActive: boolean
  bossHp: number
  bossDashes: number
  bossSummons: number
  lanternProcs: number
  muted: boolean
  speed: number
}

declare global {
  interface Window {
    __diag: Diag
  }
}

const params = new URLSearchParams(location.search)
const botOn = params.get('bot') === '1'
const stress = params.get('stress') === '1'
const seedRaw = params.get('seed')
const seed = seedRaw !== null && seedRaw !== '' ? (Number(seedRaw) >>> 0) : null
let speed = Number(params.get('speed') ?? '1')
if (!Number.isFinite(speed) || speed < 1) speed = 1
if (speed > 12) speed = 12
const bossHpRaw = Number(params.get('bosshp') ?? '0')
const bossHpOverride = Number.isFinite(bossHpRaw) && bossHpRaw > 0 ? bossHpRaw : null

const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d', { alpha: false })!

const input = new Input()
input.attach()
const audio = new AudioSys()
input.onGesture = () => audio.ensure()

const game = new Game(input, audio, { bot: botOn, stress, seed, bossHpOverride })

// --- размеры и letterbox ---
let scale = 1
let ox = 0
let oy = 0
let vignette: HTMLCanvasElement | null = null

function resize(): void {
  const dpr = Math.min(1.5, window.devicePixelRatio || 1)
  const cw = Math.max(320, Math.floor(window.innerWidth * dpr))
  const ch = Math.max(240, Math.floor(window.innerHeight * dpr))
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw
    canvas.height = ch
  }
  scale = Math.min(cw / VIEW_W, ch / VIEW_H)
  ox = Math.floor((cw - VIEW_W * scale) / 2)
  oy = Math.floor((ch - VIEW_H * scale) / 2)
  // виньетка пере-рендерится только при ресайзе
  vignette = document.createElement('canvas')
  vignette.width = VIEW_W
  vignette.height = VIEW_H
  const vc = vignette.getContext('2d')!
  const g = vc.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95)
  g.addColorStop(0, 'rgba(20, 10, 5, 0)')
  g.addColorStop(1, 'rgba(20, 10, 5, 0.4)')
  vc.fillStyle = g
  vc.fillRect(0, 0, VIEW_W, VIEW_H)
}
window.addEventListener('resize', resize)
resize()

// клик: жест для звука + кнопка mute
canvas.addEventListener('pointerdown', (e) => {
  audio.ensure()
  const dpr = Math.min(1.5, window.devicePixelRatio || 1)
  const vx = (e.clientX * dpr - ox) / scale
  const vy = (e.clientY * dpr - oy) / scale
  const mr = game.hud.muteRect
  if (vx >= mr.x && vx <= mr.x + mr.w && vy >= mr.y && vy <= mr.y + mr.h) {
    audio.toggleMute()
  }
})

// автопауза при сворачивании (кроме режима бота — ему виднее)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'run' && !botOn) {
    game.state = 'pause'
  }
})

// --- диагностика для тестов (?bot=1 и Playwright читают отсюда) ---
const diag: Diag = {
  state: 'title', time: 0, fps: 0, fps5: 0, kills: 0, level: 1, hp: 0,
  px: 0, py: 0, enemies: 0, parts: 0, projs: 0, gems: 0,
  bossActive: false, bossHp: 0, bossDashes: 0, bossSummons: 0, lanternProcs: 0,
  muted: false, speed,
}
window.__diag = diag

// кольцевой буфер времени кадров для fps
const frameTimes = new Float64Array(512)
let frameHead = 0
let frameCount = 0

function fpsOver(now: number, windowMs: number): number {
  let n = 0
  for (let i = 0; i < frameCount; i++) {
    const idx = (frameHead - 1 - i + 512) % 512
    if (now - frameTimes[idx] <= windowMs) n++
    else break
  }
  return (n * 1000) / windowMs
}

let last = performance.now()
let acc = 0
let diagTimer = 0
const MAX_STEPS = Math.max(4, Math.ceil(speed) + 3)

function frame(now: number): void {
  let dt = (now - last) / 1000
  last = now
  if (dt > 0.25) dt = 0.25
  if (dt < 0) dt = 0

  acc += dt * speed
  let steps = 0
  while (acc >= STEP && steps < MAX_STEPS) {
    game.tick(STEP)
    acc -= STEP
    steps++
  }
  if (steps >= MAX_STEPS) acc = 0 // не даём спирали смерти раскрутиться

  game.render(ctx, scale, ox, oy, vignette)

  frameTimes[frameHead] = now
  frameHead = (frameHead + 1) % 512
  if (frameCount < 512) frameCount++

  diagTimer += dt
  if (diagTimer >= 0.25) {
    diagTimer = 0
    const w = game.world
    diag.state = game.state
    diag.time = w.t
    diag.fps = Math.round(fpsOver(now, 1000))
    diag.fps5 = Math.round(fpsOver(now, 5000))
    diag.kills = w.kills
    diag.level = w.level
    diag.hp = w.player.hp
    diag.px = w.player.x
    diag.py = w.player.y
    diag.enemies = w.enemyCount
    diag.parts = w.partCount
    diag.projs = w.projCount
    diag.gems = w.gemCount
    diag.bossActive = w.boss.active && !w.boss.dead
    diag.bossHp = w.boss.hp
    diag.bossDashes = w.bossDashes
    diag.bossSummons = w.bossSummons
    diag.lanternProcs = w.lanternProcs
    diag.muted = audio.muted
  }

  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)

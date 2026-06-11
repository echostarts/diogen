import { PAL, PCOLS, VIEW_H, VIEW_W } from '../config'
import type { Sprites } from './sprites'
import type { World } from './world'
import { lanternCenter } from './weapons'

// Кэш строк для цифр урона — никаких String(v) на каждый кадр.
const NSTR: string[] = []
function nstr(v: number): string {
  if (v < 0 || v > 9999) return String(v)
  let s = NSTR[v]
  if (s === undefined) {
    s = String(v)
    NSTR[v] = s
  }
  return s
}

let shadowSpr: HTMLCanvasElement | null = null
function getShadow(): HTMLCanvasElement {
  if (!shadowSpr) {
    shadowSpr = document.createElement('canvas')
    shadowSpr.width = 48
    shadowSpr.height = 20
    const c = shadowSpr.getContext('2d')!
    const g = c.createRadialGradient(24, 10, 2, 24, 10, 22)
    g.addColorStop(0, 'rgba(25, 12, 6, 0.34)')
    g.addColorStop(1, 'rgba(25, 12, 6, 0)')
    c.fillStyle = g
    c.scale(1, 20 / 48)
    c.beginPath()
    c.arc(24, 24, 22, 0, Math.PI * 2)
    c.fill()
  }
  return shadowSpr
}

// Кэш font-строк под текущий масштаб.
let fontScale = -1
let fontNum = ''
let fontNumBig = ''
let fontFloat = ''
function fonts(s: number): void {
  if (s === fontScale) return
  fontScale = s
  fontNum = `700 ${Math.max(8, 13 * s)}px system-ui, sans-serif`
  fontNumBig = `800 ${Math.max(10, 18 * s)}px system-ui, sans-serif`
  fontFloat = `700 ${Math.max(9, 15 * s)}px system-ui, sans-serif`
}

const lpos = { x: 0, y: 0, r: 0 }

/**
 * Рисует мир в device-координатах. s — итоговый масштаб (letterbox*dpr),
 * ox/oy — смещение области вида в device px.
 */
export function drawWorld(ctx: CanvasRenderingContext2D, w: World, spr: Sprites, s: number, ox: number, oy: number): void {
  fonts(s)
  const p = w.player
  // тряска
  let shx = 0
  let shy = 0
  if (w.trauma > 0) {
    const m = w.trauma * w.trauma * 13
    shx = (w.fxr.next() * 2 - 1) * m
    shy = (w.fxr.next() * 2 - 1) * m
  }
  const camX = p.x - VIEW_W / 2 + shx
  const camY = p.y - VIEW_H / 2 + shy
  // world → device: dx = ox + s*(x - camX)
  const wx = (x: number) => ox + s * (x - camX)
  const wy = (y: number) => oy + s * (y - camY)

  // --- фон ---
  ctx.setTransform(s, 0, 0, s, ox - s * camX, oy - s * camY)
  if (spr.pattern) {
    ctx.fillStyle = spr.pattern
    ctx.fillRect(camX - 8, camY - 8, VIEW_W + 16, VIEW_H + 16)
  } else {
    ctx.fillStyle = PAL.bg
    ctx.fillRect(camX, camY, VIEW_W, VIEW_H)
  }

  // --- телеграф рывка босса (полоса на земле) ---
  const b = w.boss
  if (b.active && !b.dead && b.phase === 1) {
    ctx.save()
    ctx.translate(b.x, b.y)
    ctx.rotate(Math.atan2(b.dy, b.dx))
    const pulse = 0.22 + 0.16 * Math.sin(w.t * 22)
    ctx.fillStyle = `rgba(243, 230, 200, ${pulse.toFixed(3)})`
    const hw = b.r + 8
    ctx.fillRect(0, -hw, b.dashFull, hw * 2)
    ctx.strokeStyle = 'rgba(33, 21, 16, 0.5)'
    ctx.lineWidth = 2
    ctx.strokeRect(0, -hw, b.dashFull, hw * 2)
    // шевроны направления
    ctx.fillStyle = 'rgba(33, 21, 16, 0.4)'
    for (let i = 1; i <= 3; i++) {
      const cx = b.dashFull * (i / 4)
      ctx.beginPath()
      ctx.moveTo(cx - 8, -hw * 0.5)
      ctx.lineTo(cx + 8, 0)
      ctx.lineTo(cx - 8, hw * 0.5)
      ctx.lineTo(cx - 2, 0)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }
  // телеграф призыва — пульсирующее кольцо
  if (b.active && !b.dead && b.phase === 4) {
    ctx.strokeStyle = `rgba(227, 169, 79, ${(0.4 + 0.3 * Math.sin(w.t * 18)).toFixed(3)})`
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(b.x, b.y, 120, 0, Math.PI * 2)
    ctx.stroke()
  }

  // --- тени ---
  const sh = getShadow()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  for (let i = 0; i < w.enemyCount; i++) {
    const e = w.enemies[i]
    const r2 = e.r * 2.2 * s
    ctx.drawImage(sh, wx(e.x) - r2 / 2, wy(e.y + e.r * 0.72) - r2 / 4.8, r2, r2 / 2.4)
  }
  if (b.active && !b.dead) {
    const r2 = b.r * 2.4 * s
    ctx.drawImage(sh, wx(b.x) - r2 / 2, wy(b.y + b.r * 0.8) - r2 / 4.8, r2, r2 / 2.4)
  }
  if (!p.dead) {
    const r2 = p.r * 3 * s
    ctx.drawImage(sh, wx(p.x) - r2 / 2, wy(p.y + p.r * 0.85) - r2 / 4.8, r2, r2 / 2.4)
  }

  // --- оливки ---
  const gs = 24 * 0.9 * s
  for (let i = 0; i < w.gemCount; i++) {
    const g = w.gems[i]
    const bob = Math.sin(g.t * 4) * 2
    const k = g.v > 1 ? 1.25 : 1
    ctx.drawImage(spr.gem, wx(g.x) - (gs * k) / 2, wy(g.y + bob) - (gs * k) / 2, gs * k, gs * k)
  }

  // --- враги ---
  for (let i = 0; i < w.enemyCount; i++) {
    const e = w.enemies[i]
    const sp = spr.enemies[e.kind]
    const img = e.flash > 0 ? sp.white : sp.img
    const bob = Math.sin(w.t * 9 + e.seed * 6.28)
    const sx = (s / 2) * e.facing * (1 - bob * 0.03)
    const sy = (s / 2) * (1 + bob * 0.05)
    ctx.setTransform(sx, 0, 0, sy, wx(e.x), wy(e.y + bob * 1.2))
    ctx.drawImage(img, -sp.ax * 2, -sp.ay * 2)
  }

  // --- босс ---
  if (b.active && !b.dead) {
    const sp = spr.boss
    const img = b.flash > 0 ? sp.white : sp.img
    const bob = Math.sin(w.t * 6)
    const lunge = b.phase === 2 ? 0.12 : 0
    const sx = (s / 2) * b.facing * (1 + lunge)
    const sy = (s / 2) * (1 + bob * 0.02 - lunge * 0.5)
    ctx.setTransform(sx, 0, 0, sy, wx(b.x), wy(b.y + bob))
    ctx.drawImage(img, -sp.ax * 2, -sp.ay * 2)
  }

  // --- игрок: Диоген в бочке ---
  const blink = p.invuln > 0 && (Math.floor(p.invuln * 14) & 1) === 0
  if (!p.dead && !blink) {
    ctx.setTransform(s, 0, 0, s, wx(p.x), wy(p.y))
    const tilt = Math.max(-0.16, Math.min(0.16, p.vx * 0.0007)) + Math.sin(p.dist * 0.06) * 0.03
    ctx.rotate(tilt)
    const squash = p.dashT > 0 ? 1.12 : 1
    ctx.scale(squash, 2 - squash)
    // бочка
    ctx.fillStyle = PAL.ink
    ctx.beginPath()
    ctx.roundRect(-17, -10, 34, 22, 9)
    ctx.fill()
    // клёпки бегут при качении (приглушённо, чтобы не было «сетки»)
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(-16, -9, 32, 20, 8)
    ctx.clip()
    ctx.strokeStyle = 'rgba(227, 169, 79, 0.32)'
    ctx.lineWidth = 1.8
    for (let i = 0; i < 3; i++) {
      const bx = ((p.dist * 0.7 * p.facing + i * 13.3) % 40 + 40) % 40 - 20
      ctx.beginPath()
      ctx.moveTo(bx, -10)
      ctx.quadraticCurveTo(bx + 3, 1, bx, 12)
      ctx.stroke()
    }
    // обручи
    ctx.strokeStyle = 'rgba(243, 230, 200, 0.85)'
    ctx.lineWidth = 1.6
    ctx.beginPath(); ctx.moveTo(-17, -3); ctx.lineTo(17, -3); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(-17, 7); ctx.lineTo(17, 7); ctx.stroke()
    ctx.restore()
    // Диоген: голова с бородой и рука над кромкой
    ctx.fillStyle = PAL.ink
    ctx.beginPath()
    ctx.arc(2 * p.facing, -17, 5.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo((2 - 5) * p.facing, -15)
    ctx.lineTo(2 * p.facing, -6.5)
    ctx.lineTo((2 + 5) * p.facing, -15)
    ctx.closePath()
    ctx.fill()
    // повязка и глаз
    ctx.fillStyle = PAL.ochre
    ctx.fillRect(2 * p.facing - 5.6, -21, 11.2, 1.8)
    ctx.fillStyle = PAL.cream
    ctx.fillRect(2 * p.facing + 1.8 * p.facing, -18.6, 1.6, 1.6)
    // рука на кромке
    ctx.fillStyle = PAL.ink
    ctx.beginPath()
    ctx.arc(10 * p.facing, -10, 2.4, 0, Math.PI * 2)
    ctx.fill()
  }

  // --- псы ---
  for (let i = 0; i < w.dogCount; i++) {
    const d = w.dogs[i]
    const sp = spr.dog
    const run = d.state === 1 ? Math.sin(w.t * 30 + d.seed * 9) * 0.08 : Math.sin(w.t * 10 + d.seed * 9) * 0.04
    const sx = (s / 2) * d.facing
    const sy = (s / 2) * (1 + run)
    ctx.setTransform(sx, 0, 0, sy, wx(d.x), wy(d.y))
    ctx.drawImage(sp.img, -sp.ax * 2, -sp.ay * 2)
  }

  // --- снаряды ---
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  for (let i = 0; i < w.projCount; i++) {
    const pr = w.projs[i]
    const px = wx(pr.x)
    const py = wy(pr.y)
    if (pr.hostile) {
      // свиток софиста
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(pr.life * 5)
      ctx.fillStyle = PAL.cream
      ctx.fillRect(-7 * s, -3.5 * s, 14 * s, 7 * s)
      ctx.fillStyle = PAL.ochre
      ctx.fillRect(-7 * s, -3.5 * s, 2.6 * s, 7 * s)
      ctx.fillRect((7 - 2.6) * s, -3.5 * s, 2.6 * s, 7 * s)
      ctx.strokeStyle = PAL.ink
      ctx.lineWidth = 1.2 * s
      ctx.strokeRect(-7 * s, -3.5 * s, 14 * s, 7 * s)
      ctx.restore()
    } else {
      ctx.fillStyle = PAL.cream
      ctx.beginPath()
      ctx.arc(px, py, pr.r * s, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(px, py, pr.r * 0.45 * s, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // --- свет фонаря (аддитивно) ---
  if (w.weapons.lantern > 0 && !p.dead) {
    lanternCenter(w, lpos)
    const flick = 0.9 + 0.1 * Math.sin(w.t * 13) + (w.lanternPulse > 0 ? 0.35 : 0)
    const R = lpos.r * (1 + (w.lanternPulse > 0 ? 0.06 : 0)) * s
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = Math.min(1, flick)
    ctx.drawImage(spr.glow, wx(lpos.x) - R, wy(lpos.y) - R, R * 2, R * 2)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    // сам фонарь
    const lx = wx(lpos.x)
    const ly = wy(lpos.y)
    ctx.fillStyle = PAL.ink
    ctx.fillRect(lx - 4 * s, ly - 6 * s, 8 * s, 10 * s)
    ctx.fillStyle = PAL.glow
    ctx.fillRect(lx - 2.4 * s, ly - 4 * s, 4.8 * s, 6 * s)
    ctx.fillStyle = PAL.ink
    ctx.fillRect(lx - 1.4 * s, ly - 9 * s, 2.8 * s, 3 * s)
    // граница круга света — чтобы читалась зона урона
    ctx.strokeStyle = 'rgba(255, 217, 160, 0.35)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(wx(lpos.x), wy(lpos.y), lpos.r * s, 0, Math.PI * 2)
    ctx.stroke()
  }

  // --- индикатор заряда рывка вокруг бочки ---
  if (w.weapons.barrel > 0 && !p.dead && p.charge > 0.02) {
    const full = p.charge >= 1
    ctx.strokeStyle = full ? 'rgba(243, 230, 200, 0.95)' : 'rgba(227, 169, 79, 0.7)'
    ctx.lineWidth = (full ? 3 : 2.2) * s * 0.5
    ctx.beginPath()
    ctx.arc(wx(p.x), wy(p.y), 22 * s, -Math.PI / 2, -Math.PI / 2 + p.charge * Math.PI * 2)
    ctx.stroke()
  }

  // --- частицы ---
  for (let i = 0; i < w.partCount; i++) {
    const pt = w.parts[i]
    const a = pt.life / pt.max
    ctx.globalAlpha = a > 1 ? 1 : a
    ctx.fillStyle = PCOLS[pt.col]
    const sz = pt.size * s
    ctx.fillRect(wx(pt.x) - sz / 2, wy(pt.y) - sz / 2, sz, sz)
  }
  ctx.globalAlpha = 1

  // --- цифры урона ---
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < w.numCount; i++) {
    const n = w.nums[i]
    const a = 1 - n.t / 0.7
    ctx.globalAlpha = a < 0 ? 0 : a
    ctx.font = n.big ? fontNumBig : fontNum
    const tx = wx(n.x)
    const ty = wy(n.y)
    ctx.fillStyle = PAL.ink
    ctx.fillText(nstr(n.v), tx + 1, ty + 1.5)
    ctx.fillStyle = n.big ? PAL.glow : PAL.cream
    ctx.fillText(nstr(n.v), tx, ty)
  }
  ctx.globalAlpha = 1

  // --- всплывающие подписи ---
  ctx.font = fontFloat
  for (let i = 0; i < w.floaters.length; i++) {
    const f = w.floaters[i]
    if (f.t <= 0) continue
    const a = Math.min(1, f.t / 0.6)
    ctx.globalAlpha = a
    const tx = wx(f.x)
    const ty = wy(f.y)
    ctx.fillStyle = PAL.ink
    ctx.fillText(f.text, tx + 1, ty + 1.5)
    ctx.fillStyle = PAL.glow
    ctx.fillText(f.text, tx, ty)
  }
  ctx.globalAlpha = 1
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}

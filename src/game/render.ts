import { EK_PLATO, PAL, PCOLS, VIEW_H, VIEW_W } from '../config'
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
  fontNum = `700 ${Math.max(8, 13 * s)}px Philosopher, system-ui, sans-serif`
  fontNumBig = `800 ${Math.max(10, 18 * s)}px Philosopher, system-ui, sans-serif`
  fontFloat = `700 ${Math.max(9, 15 * s)}px Philosopher, system-ui, sans-serif`
}

const lpos = { x: 0, y: 0, r: 0 }

// Стрелка на краю экрана к важной цели за кадром.
function edgePointer(
  ctx: CanvasRenderingContext2D, label: string, color: string,
  tx: number, ty: number, camX: number, camY: number,
  s: number, ox: number, oy: number, font: string,
): void {
  // цель в видовых координатах
  const vx = tx - camX
  const vy = ty - camY
  if (vx > -30 && vx < VIEW_W + 30 && vy > -30 && vy < VIEW_H + 30) return // и так видно
  const cx = VIEW_W / 2
  const cy = VIEW_H / 2
  const dx = vx - cx
  const dy = vy - cy
  const a = Math.atan2(dy, dx)
  // прижимаем точку к рамке с отступом
  const inset = 46
  const kx = dx !== 0 ? (dx > 0 ? (VIEW_W - inset - cx) / dx : (inset - cx) / dx) : Infinity
  const ky = dy !== 0 ? (dy > 0 ? (VIEW_H - inset - cy) / dy : (inset - cy) / dy) : Infinity
  const k = Math.min(kx, ky)
  const px = ox + (cx + dx * k) * s
  const py = oy + (cy + dy * k) * s
  // стрелка
  const cos = Math.cos(a) * s
  const sin = Math.sin(a) * s
  ctx.setTransform(cos, sin, -sin, cos, px, py)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(16, 0)
  ctx.lineTo(2, -8)
  ctx.lineTo(5, 0)
  ctx.lineTo(2, 8)
  ctx.closePath()
  ctx.fill()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  // подпись с подложкой
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(33, 21, 16, 0.65)'
  const tw = ctx.measureText(label).width
  ctx.fillRect(px - tw / 2 - 5 * s, py + 12 * s, tw + 10 * s, 15 * s)
  ctx.fillStyle = color
  ctx.fillText(label, px, py + 19.5 * s)
}
function cellHash(cx: number, cy: number, salt: number): number {
  let h = (cx * 374761393 + cy * 668265263 + salt * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * Рисует мир в device-координатах. s — итоговый масштаб (letterbox*dpr),
 * ox/oy — смещение области вида в device px. lowQ — режим экономии филлрейта.
 */
export function drawWorld(ctx: CanvasRenderingContext2D, w: World, spr: Sprites, s: number, ox: number, oy: number, lowQ: boolean): void {
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
  // отсечение: видимая область с запасом
  const vx0 = camX - 70
  const vx1 = camX + VIEW_W + 70
  const vy0 = camY - 80
  const vy1 = camY + VIEW_H + 80

  // --- фон ---
  ctx.setTransform(s, 0, 0, s, ox - s * camX, oy - s * camY)
  if (spr.pattern) {
    ctx.fillStyle = spr.pattern
    ctx.fillRect(camX - 8, camY - 8, VIEW_W + 16, VIEW_H + 16)
  } else {
    ctx.fillStyle = PAL.bg
    ctx.fillRect(camX, camY, VIEW_W, VIEW_H)
  }

  // --- реквизит агоры (детерминированная сетка, чисто декорация) ---
  {
    const CELL = 460
    const c0x = Math.floor(vx0 / CELL)
    const c1x = Math.floor(vx1 / CELL)
    const c0y = Math.floor(vy0 / CELL)
    const c1y = Math.floor(vy1 / CELL)
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const h = cellHash(cx, cy, 7)
        if (h > 0.62) continue
        const type = (cellHash(cx, cy, 13) * spr.props.length) | 0
        const px = (cx + 0.18 + cellHash(cx, cy, 21) * 0.64) * CELL
        const py = (cy + 0.18 + cellHash(cx, cy, 33) * 0.64) * CELL
        const img = spr.props[type]
        ctx.drawImage(img, px - img.width / 2, py - img.height + 10)
      }
    }
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

  // --- тени (в лоу-режиме экономим филлрейт) ---
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  if (!lowQ) {
    const sh = getShadow()
    for (let i = 0; i < w.enemyCount; i++) {
      const e = w.enemies[i]
      if (e.x < vx0 || e.x > vx1 || e.y < vy0 || e.y > vy1) continue
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
  }

  // --- оливки ---
  const gs = 24 * 0.9 * s
  for (let i = 0; i < w.gemCount; i++) {
    const g = w.gems[i]
    if (g.x < vx0 || g.x > vx1 || g.y < vy0 || g.y > vy1) continue
    const bob = Math.sin(g.t * 4) * 2
    const k = g.v > 1 ? 1.25 : 1
    ctx.drawImage(spr.gem, wx(g.x) - (gs * k) / 2, wy(g.y + bob) - (gs * k) / 2, gs * k, gs * k)
  }

  // --- метки элит (кольцо под ногами) ---
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.strokeStyle = 'rgba(227, 169, 79, 0.55)'
  ctx.lineWidth = 2
  for (let i = 0; i < w.enemyCount; i++) {
    const e = w.enemies[i]
    if (!e.elite) continue
    if (e.x < vx0 || e.x > vx1 || e.y < vy0 || e.y > vy1) continue
    ctx.beginPath()
    ctx.arc(wx(e.x), wy(e.y + e.r * 0.72), e.r * 1.15 * s, 0, Math.PI * 2)
    ctx.stroke()
  }

  // --- враги ---
  for (let i = 0; i < w.enemyCount; i++) {
    const e = w.enemies[i]
    if (e.x < vx0 || e.x > vx1 || e.y < vy0 || e.y > vy1) continue
    const sp = spr.enemies[e.kind]
    const f = (Math.floor(w.t * 7.5 + e.seed * 8) & 1)
    const img = e.flash > 0 ? sp.white[f] : sp.img[f]
    const bob = Math.sin(w.t * 9 + e.seed * 6.28)
    const big = e.elite ? 1.35 : 1
    const sx = (s / 2) * big * e.facing * (1 - bob * 0.03)
    const sy = (s / 2) * big * (1 + bob * 0.05)
    ctx.setTransform(sx, 0, 0, sy, wx(e.x), wy(e.y + bob * 1.2))
    ctx.drawImage(img, -sp.ax * 2, -sp.ay * 2)
  }

  // --- босс ---
  if (b.active && !b.dead && b.x > vx0 - 60 && b.x < vx1 + 60 && b.y > vy0 - 60 && b.y < vy1 + 60) {
    const sp = spr.boss
    const f = Math.floor(w.t * 5) & 1
    const img = b.flash > 0 ? sp.white[f] : sp.img[f]
    const bob = Math.sin(w.t * 6)
    const lunge = b.phase === 2 ? 0.12 : 0
    const sx = (s / 2) * b.facing * (1 + lunge)
    const sy = (s / 2) * (1 + bob * 0.02 - lunge * 0.5)
    ctx.setTransform(sx, 0, 0, sy, wx(b.x), wy(b.y + bob))
    ctx.drawImage(img, -sp.ax * 2, -sp.ay * 2)
  }

  // --- игрок ---
  const blink = p.invuln > 0 && (Math.floor(p.invuln * 14) & 1) === 0
  if (!p.dead && !blink && !w.chr.barrel) {
    // Гиппархия: пешком, с посохом
    ctx.setTransform(s, 0, 0, s, wx(p.x), wy(p.y))
    const moving = Math.hypot(p.vx, p.vy) > 10
    const stride = moving ? Math.sin(p.dist * 0.14) : 0
    ctx.rotate(stride * 0.04)
    ctx.translate(0, -Math.abs(stride) * 1.6)
    const f = p.facing
    // хитон-колокол с разлётом при шаге
    ctx.fillStyle = PAL.ink
    ctx.beginPath()
    ctx.moveTo(-7 - stride * 2.5, 14)
    ctx.quadraticCurveTo(-6, -4, -4, -8)
    ctx.lineTo(4, -8)
    ctx.quadraticCurveTo(6, -4, 7 + stride * 2.5, 14)
    ctx.closePath()
    ctx.fill()
    // гиматий — диагональная складка
    ctx.strokeStyle = PAL.ochre
    ctx.lineWidth = 1.8
    ctx.beginPath()
    ctx.moveTo(-4 * f, -6)
    ctx.quadraticCurveTo(0, 2, 5 * f, 12)
    ctx.stroke()
    // голова с пучком и лентой
    ctx.fillStyle = PAL.ink
    ctx.beginPath()
    ctx.arc(1 * f, -13.5, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(-3.6 * f, -16.5, 2.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = PAL.ochre
    ctx.fillRect(1 * f - 5, -16.6, 10, 1.6)
    ctx.fillStyle = PAL.cream
    ctx.fillRect(1 * f + 1.6 * f, -14.6, 1.4, 1.4)
    // посох киника
    ctx.strokeStyle = PAL.ink
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(8 * f, -10)
    ctx.lineTo((8 + stride * 1.5) * f, 14)
    ctx.stroke()
    ctx.fillStyle = PAL.ink
    ctx.beginPath()
    ctx.arc(8 * f, -10.5, 2, 0, Math.PI * 2)
    ctx.fill()
  } else if (!p.dead && !blink) {
    // Диоген в бочке
    const pifos = w.evoPithos ? 1.16 : 1
    ctx.setTransform(s * pifos, 0, 0, s * pifos, wx(p.x), wy(p.y))
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
    const f = Math.floor(w.t * (d.state === 1 ? 14 : 8) + d.seed * 8) & 1
    const sx = (s / 2) * d.facing
    const sy = (s / 2) * (1 + run)
    ctx.setTransform(sx, 0, 0, sy, wx(d.x), wy(d.y))
    ctx.drawImage(sp.img[f], -sp.ax * 2, -sp.ay * 2)
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
      // плевок-комета, хвост против движения
      const a = Math.atan2(pr.vy, pr.vx)
      const k = (pr.r / 6) * s * 0.55
      const cos = Math.cos(a) * k
      const sin = Math.sin(a) * k
      ctx.setTransform(cos, sin, -sin, cos, px, py)
      ctx.drawImage(spr.spit, -44, -12)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
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
    if (w.sun) {
      // эволюция: корона лучей вокруг бочки
      ctx.strokeStyle = 'rgba(255, 217, 160, 0.5)'
      ctx.lineWidth = 2.5
      const spin = w.t * 0.35
      for (let i = 0; i < 10; i++) {
        const a = spin + (i / 10) * Math.PI * 2
        const r0 = (lpos.r - 7) * s
        const r1 = (lpos.r + 6) * s
        ctx.beginPath()
        ctx.moveTo(wx(lpos.x) + Math.cos(a) * r0, wy(lpos.y) + Math.sin(a) * r0)
        ctx.lineTo(wx(lpos.x) + Math.cos(a) * r1, wy(lpos.y) + Math.sin(a) * r1)
        ctx.stroke()
      }
    } else {
      // сам фонарь
      const lx = wx(lpos.x)
      const ly = wy(lpos.y)
      ctx.fillStyle = PAL.ink
      ctx.fillRect(lx - 4 * s, ly - 6 * s, 8 * s, 10 * s)
      ctx.fillStyle = PAL.glow
      ctx.fillRect(lx - 2.4 * s, ly - 4 * s, 4.8 * s, 6 * s)
      ctx.fillStyle = PAL.ink
      ctx.fillRect(lx - 1.4 * s, ly - 9 * s, 2.8 * s, 3 * s)
    }
    // граница круга света — чтобы читалась зона урона
    if (!lowQ) {
      ctx.strokeStyle = 'rgba(255, 217, 160, 0.35)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(wx(lpos.x), wy(lpos.y), lpos.r * s, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  // --- индикатор заряда рывка/шага вокруг героя ---
  if ((w.weapons.barrel > 0 || (!w.chr.barrel && w.chr.dodgeCd > 0)) && !p.dead && p.charge > 0.02) {
    const full = p.charge >= 1
    ctx.strokeStyle = full ? 'rgba(243, 230, 200, 0.95)' : 'rgba(227, 169, 79, 0.7)'
    ctx.lineWidth = (full ? 3 : 2.2) * s * 0.5
    ctx.beginPath()
    ctx.arc(wx(p.x), wy(p.y), 22 * s, -Math.PI / 2, -Math.PI / 2 + p.charge * Math.PI * 2)
    ctx.stroke()
  }

  // --- частицы ---
  const partMax = lowQ ? Math.min(w.partCount, 220) : w.partCount
  for (let i = 0; i < partMax; i++) {
    const pt = w.parts[i]
    if (pt.x < vx0 || pt.x > vx1 || pt.y < vy0 || pt.y > vy1) continue
    const a = pt.life / pt.max
    ctx.globalAlpha = a > 1 ? 1 : a
    const sz = pt.size * s
    if (pt.shape === 1) {
      // глиняный черепок: терракотовый осколок с тёмной кромкой глазури
      const cos = Math.cos(pt.rot)
      const sin = Math.sin(pt.rot)
      ctx.setTransform(cos, sin, -sin, cos, wx(pt.x), wy(pt.y))
      ctx.fillStyle = '#c8703a'
      ctx.beginPath()
      ctx.moveTo(-sz * 0.6, sz * 0.45)
      ctx.lineTo(0, -sz * 0.65)
      ctx.lineTo(sz * 0.62, sz * 0.3)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = PAL.ink
      ctx.beginPath()
      ctx.moveTo(-sz * 0.6, sz * 0.45)
      ctx.lineTo(0, -sz * 0.65)
      ctx.lineTo(sz * 0.18, -sz * 0.34)
      ctx.lineTo(-sz * 0.38, sz * 0.4)
      ctx.closePath()
      ctx.fill()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
    } else {
      ctx.fillStyle = PCOLS[pt.col]
      ctx.fillRect(wx(pt.x) - sz / 2, wy(pt.y) - sz / 2, sz, sz)
    }
  }
  ctx.globalAlpha = 1

  // --- цифры урона ---
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < w.numCount; i++) {
    const n = w.nums[i]
    if (n.x < vx0 || n.x > vx1 || n.y < vy0 || n.y > vy1) continue
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

  // --- указатели на боссов за кадром ---
  if (w.miniSpawned) {
    for (let i = 0; i < w.enemyCount; i++) {
      const e = w.enemies[i]
      if (e.kind === EK_PLATO && !e.dying) {
        edgePointer(ctx, 'ПЛАТОН', PAL.ochre, e.x, e.y, camX, camY, s, ox, oy, fontFloat)
        break
      }
    }
  }
  if (b.active && !b.dead) {
    edgePointer(ctx, 'АЛЕКСАНДР', PAL.glow, b.x, b.y, camX, camY, s, ox, oy, fontFloat)
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
}

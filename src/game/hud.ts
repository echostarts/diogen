import { PAL, VIEW_H, VIEW_W } from '../config'
import { drawIcon } from './icons'
import type { World } from './world'

const WEAPON_IDS = ['w_lantern', 'w_spit', 'w_dogs', 'w_barrel'] as const
const WEAPON_KEYS = ['lantern', 'spit', 'dogs', 'barrel'] as const

export interface StickState {
  active: boolean
  ox: number
  oy: number
  dx: number
  dy: number
}

// HUD кэширует все строки, чтобы не плодить аллокации в кадре.
export class Hud {
  readonly muteRect = { x: VIEW_W - 46, y: 56, w: 34, h: 30 }
  readonly pauseRect = { x: VIEW_W - 88, y: 56, w: 34, h: 30 }
  private lastSec = -1
  private timeStr = '0:00'
  private lastKills = -1
  private killsStr = '0'
  private lastHpKey = -1
  private hpStr = '100/100'
  private lastLevel = -1
  private levelStr = 'УР 1'

  /** Рисует HUD. Транформ уже выставлен в view-координаты (1280×720). */
  draw(ctx: CanvasRenderingContext2D, w: World, muted: boolean, stick: StickState | null, coarse: boolean): void {
    const p = w.player

    // --- XP-бар во всю ширину ---
    ctx.fillStyle = 'rgba(33, 21, 16, 0.65)'
    ctx.fillRect(0, 0, VIEW_W, 12)
    ctx.fillStyle = PAL.cream
    ctx.fillRect(0, 0, VIEW_W * Math.min(1, w.xp / w.xpNeed), 12)
    if (w.level !== this.lastLevel) {
      this.lastLevel = w.level
      this.levelStr = 'УР ' + w.level
    }
    ctx.font = '700 15px system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillStyle = PAL.ink
    ctx.fillText(this.levelStr, 9, 21)
    ctx.fillStyle = PAL.cream
    ctx.fillText(this.levelStr, 8, 20)

    // --- HP-бар ---
    const hpW = 200
    const hpX = 8
    const hpY = 42
    ctx.fillStyle = 'rgba(33, 21, 16, 0.75)'
    ctx.fillRect(hpX - 2, hpY - 2, hpW + 4, 20)
    const ratio = Math.max(0, p.hp / p.maxHp)
    ctx.fillStyle = ratio > 0.35 ? PAL.ochre : PAL.blood
    ctx.fillRect(hpX, hpY, hpW * ratio, 16)
    ctx.strokeStyle = PAL.cream
    ctx.lineWidth = 1.5
    ctx.strokeRect(hpX - 2, hpY - 2, hpW + 4, 20)
    const hpKey = (Math.ceil(p.hp) << 11) | p.maxHp
    if (hpKey !== this.lastHpKey) {
      this.lastHpKey = hpKey
      this.hpStr = Math.max(0, Math.ceil(p.hp)) + '/' + p.maxHp
    }
    ctx.font = '700 12px system-ui, sans-serif'
    ctx.fillStyle = PAL.cream
    ctx.fillText(this.hpStr, hpX + 6, hpY + 2.5)

    // --- таймер ---
    const sec = Math.floor(w.t)
    if (sec !== this.lastSec) {
      this.lastSec = sec
      const m = Math.floor(sec / 60)
      const s = sec % 60
      this.timeStr = m + ':' + (s < 10 ? '0' : '') + s
    }
    ctx.font = '800 32px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = PAL.ink
    ctx.fillText(this.timeStr, VIEW_W / 2 + 2, 24)
    ctx.fillStyle = PAL.cream
    ctx.fillText(this.timeStr, VIEW_W / 2, 22)

    // --- счётчик убеждённых ---
    if (w.kills !== this.lastKills) {
      this.lastKills = w.kills
      this.killsStr = String(w.kills)
    }
    ctx.textAlign = 'right'
    ctx.font = '700 13px system-ui, sans-serif'
    ctx.fillStyle = 'rgba(243, 230, 200, 0.75)'
    ctx.fillText('ПЕРЕУБЕЖДЕНО', VIEW_W - 10, 22)
    ctx.font = '800 22px system-ui, sans-serif'
    ctx.fillStyle = PAL.cream
    ctx.fillText(this.killsStr, VIEW_W - 10, 36)

    // --- кнопка звука ---
    const mr = this.muteRect
    ctx.fillStyle = 'rgba(33, 21, 16, 0.55)'
    ctx.beginPath()
    ctx.roundRect(mr.x, mr.y, mr.w, mr.h, 6)
    ctx.fill()
    const mx = mr.x + 13
    const my = mr.y + mr.h / 2
    ctx.fillStyle = PAL.cream
    ctx.beginPath()
    ctx.moveTo(mx - 6, my - 3.5)
    ctx.lineTo(mx - 2, my - 3.5)
    ctx.lineTo(mx + 3, my - 8)
    ctx.lineTo(mx + 3, my + 8)
    ctx.lineTo(mx - 2, my + 3.5)
    ctx.lineTo(mx - 6, my + 3.5)
    ctx.closePath()
    ctx.fill()
    if (muted) {
      ctx.strokeStyle = PAL.blood
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.moveTo(mx + 7, my - 6)
      ctx.lineTo(mx + 15, my + 6)
      ctx.moveTo(mx + 15, my - 6)
      ctx.lineTo(mx + 7, my + 6)
      ctx.stroke()
    } else {
      ctx.strokeStyle = PAL.cream
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(mx + 5, my, 6, -0.9, 0.9)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(mx + 5, my, 10, -0.7, 0.7)
      ctx.stroke()
    }

    // --- иконки взятого оружия с уровнями ---
    let slot = 0
    for (let i = 0; i < 4; i++) {
      const lvl = w.weapons[WEAPON_KEYS[i]]
      if (lvl <= 0) continue
      const x = 10 + slot * 50
      const y = VIEW_H - 58
      ctx.fillStyle = 'rgba(33, 21, 16, 0.6)'
      ctx.beginPath()
      ctx.roundRect(x, y, 44, 44, 7)
      ctx.fill()
      ctx.strokeStyle = 'rgba(243, 230, 200, 0.5)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      drawIcon(ctx, i === 0 && w.sun ? 'w_sun' : WEAPON_IDS[i], x + 22, y + 20, 26)
      // пипсы уровня
      for (let k = 0; k < 5; k++) {
        const px = x + 7 + k * 8
        ctx.fillStyle = k < lvl ? PAL.ochre : 'rgba(243, 230, 200, 0.25)'
        ctx.fillRect(px, y + 37, 5, 3)
      }
      slot++
    }

    // --- кнопка паузы (для тача, но кликается и мышью) ---
    const pr = this.pauseRect
    ctx.fillStyle = 'rgba(33, 21, 16, 0.55)'
    ctx.beginPath()
    ctx.roundRect(pr.x, pr.y, pr.w, pr.h, 6)
    ctx.fill()
    ctx.fillStyle = PAL.cream
    ctx.fillRect(pr.x + 11, pr.y + 8, 4, 14)
    ctx.fillRect(pr.x + 19, pr.y + 8, 4, 14)

    // --- виртуальный стик ---
    if (stick && stick.active) {
      ctx.strokeStyle = 'rgba(243, 230, 200, 0.35)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(stick.ox, stick.oy, 46, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = 'rgba(243, 230, 200, 0.45)'
      ctx.beginPath()
      ctx.arc(stick.ox + stick.dx * 46, stick.oy + stick.dy * 46, 18, 0, Math.PI * 2)
      ctx.fill()
    }

    // --- заряд рывка ---
    if (w.weapons.barrel > 0) {
      const bw = 150
      const bx = VIEW_W - bw - 12
      const by = VIEW_H - 30
      ctx.textAlign = 'left'
      ctx.font = '700 11px system-ui, sans-serif'
      ctx.fillStyle = 'rgba(243, 230, 200, 0.75)'
      ctx.fillText(coarse ? 'РЫВОК — ТАП СПРАВА' : 'РЫВОК — ПРОБЕЛ', bx, by - 14)
      ctx.fillStyle = 'rgba(33, 21, 16, 0.7)'
      ctx.fillRect(bx - 2, by - 2, bw + 4, 14)
      const full = p.charge >= 1
      ctx.fillStyle = full ? PAL.cream : PAL.ochre
      ctx.fillRect(bx, by, bw * Math.min(1, p.charge), 10)
      if (full) {
        ctx.strokeStyle = PAL.glow
        ctx.lineWidth = 2
        ctx.strokeRect(bx - 2, by - 2, bw + 4, 14)
      }
    }

    // --- полоса HP босса ---
    const b = w.boss
    if (b.active && !b.dead) {
      const bw = 420
      const bx = (VIEW_W - bw) / 2
      const by = 64
      ctx.textAlign = 'center'
      ctx.font = '800 15px system-ui, sans-serif'
      ctx.fillStyle = PAL.ink
      ctx.fillText('АЛЕКСАНДР', VIEW_W / 2 + 1, by - 17)
      ctx.fillStyle = PAL.ochre
      ctx.fillText('АЛЕКСАНДР', VIEW_W / 2, by - 18)
      ctx.fillStyle = 'rgba(33, 21, 16, 0.8)'
      ctx.fillRect(bx - 2, by - 2, bw + 4, 16)
      ctx.fillStyle = PAL.blood
      ctx.fillRect(bx, by, bw * Math.max(0, b.hp / b.maxHp), 12)
      ctx.strokeStyle = PAL.cream
      ctx.lineWidth = 1.5
      ctx.strokeRect(bx - 2, by - 2, bw + 4, 16)
    }

    // --- субтитр-подпись ---
    if (w.captionT > 0 && w.caption) {
      const a = Math.min(1, w.captionT / 0.5)
      ctx.globalAlpha = a
      ctx.textAlign = 'center'
      ctx.font = '800 26px system-ui, sans-serif'
      ctx.fillStyle = PAL.ink
      ctx.fillText(w.caption, VIEW_W / 2 + 2, VIEW_H - 106)
      ctx.fillStyle = PAL.glow
      ctx.fillText(w.caption, VIEW_W / 2, VIEW_H - 108)
      ctx.globalAlpha = 1
    }
  }
}

import { PAL, VIEW_H, VIEW_W } from '../config'
import { drawIcon } from './icons'
import { defByIndex, roman } from './upgrades'
import type { World } from './world'

function meander(ctx: CanvasRenderingContext2D, y: number, alpha: number): void {
  ctx.strokeStyle = `rgba(243, 230, 200, ${alpha})`
  ctx.lineWidth = 3
  const u = 36
  ctx.beginPath()
  for (let x = 40; x < VIEW_W - 40; x += u) {
    ctx.moveTo(x, y + 11)
    ctx.lineTo(x, y - 11)
    ctx.lineTo(x + u * 0.7, y - 11)
    ctx.lineTo(x + u * 0.7, y + 2)
    ctx.lineTo(x + u * 0.33, y + 2)
    ctx.lineTo(x + u * 0.33, y - 5)
  }
  ctx.stroke()
}

function dim(ctx: CanvasRenderingContext2D, a: number): void {
  ctx.fillStyle = `rgba(22, 12, 8, ${a})`
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number): void {
  const words = text.split(' ')
  let line = ''
  let yy = y
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i]
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy)
      line = words[i]
      yy += lh
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, yy)
}

export function drawTitle(ctx: CanvasRenderingContext2D, time: number, coarse: boolean, best: string | null): void {
  dim(ctx, 0.42)
  meander(ctx, 86, 0.5)
  meander(ctx, VIEW_H - 70, 0.5)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = '900 110px system-ui, sans-serif'
  ctx.fillStyle = PAL.ink
  ctx.fillText('ДИОГЕН', VIEW_W / 2 + 5, 256)
  ctx.fillStyle = PAL.cream
  ctx.fillText('ДИОГЕН', VIEW_W / 2, 250)
  ctx.font = '700 24px system-ui, sans-serif'
  ctx.fillStyle = PAL.ochre
  ctx.fillText('АФИНЫ, 350 ГОД ДО Н. Э. ГРАЖДАНЕ ВОЗМУЩЕНЫ.', VIEW_W / 2, 300)
  ctx.font = '400 17px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(243, 230, 200, 0.85)'
  ctx.fillText('Вы — Диоген. У вас бочка, фонарь и пять минут до прихода Александра.', VIEW_W / 2, 336)
  if (best) {
    ctx.font = '600 16px system-ui, sans-serif'
    ctx.fillStyle = 'rgba(227, 169, 79, 0.95)'
    ctx.fillText(best, VIEW_W / 2, 370)
  }

  ctx.font = '600 17px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(243, 230, 200, 0.9)'
  const lines = coarse
    ? [
        'Палец на левой половине экрана — стик, катит бочку',
        'Тап справа — рывок (когда найдёте, чем таранить)',
        'Пауза и звук — кнопки в правом верхнем углу',
        'Атаки сами по себе. Как и вы.',
      ]
    : [
        'WASD / СТРЕЛКИ — катить бочку',
        'ПРОБЕЛ — рывок (когда найдёте, чем таранить)',
        'ESC / P — пауза · M — звук',
        'Атаки сами по себе. Как и вы.',
      ]
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], VIEW_W / 2, 422 + i * 30)
  }

  const pulse = 0.6 + 0.4 * Math.sin(time * 4)
  ctx.globalAlpha = pulse
  ctx.font = '800 28px system-ui, sans-serif'
  ctx.fillStyle = PAL.glow
  ctx.fillText(coarse ? 'ТАП — НАЧАТЬ' : 'ENTER — НАЧАТЬ', VIEW_W / 2, 580)
  ctx.globalAlpha = 1
}

// Кнопка лавки на тайтле (для тапа) и строка кошелька.
export const SHOP_BTN = { x: VIEW_W / 2 - 110, y: 596, w: 220, h: 42 }

export function drawShopButton(ctx: CanvasRenderingContext2D, wallet: number, coarse: boolean): void {
  const b = SHOP_BTN
  ctx.fillStyle = 'rgba(33, 21, 16, 0.6)'
  ctx.beginPath()
  ctx.roundRect(b.x, b.y, b.w, b.h, 8)
  ctx.fill()
  ctx.strokeStyle = 'rgba(227, 169, 79, 0.8)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.font = '800 18px system-ui, sans-serif'
  ctx.fillStyle = PAL.ochre
  ctx.fillText(coarse ? 'ЛАВКА' : 'ЛАВКА — L', b.x + b.w / 2, b.y + 19)
  ctx.font = '600 13px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(243, 230, 200, 0.85)'
  ctx.fillText('черепков: ' + wallet, b.x + b.w / 2, b.y + 35)
}

// Геометрия рядов лавки — общая для отрисовки и тач-попаданий.
export const SHOP_PANEL = { x: VIEW_W / 2 - 330, y: 140, w: 660, h: 460 }
export const SHOP_ROW_Y = 262
export const SHOP_ROW_H = 64

export interface ShopRow {
  name: string
  desc: string
  lvl: number
  max: number
  cost: number // -1 = выкуплено до конца
}

export function drawShop(ctx: CanvasRenderingContext2D, rows: ShopRow[], sel: number, wallet: number, coarse: boolean): void {
  dim(ctx, 0.62)
  const P = SHOP_PANEL
  ctx.fillStyle = 'rgba(26, 15, 10, 0.95)'
  ctx.beginPath()
  ctx.roundRect(P.x, P.y, P.w, P.h, 14)
  ctx.fill()
  ctx.strokeStyle = 'rgba(227, 169, 79, 0.7)'
  ctx.lineWidth = 2.5
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.font = '900 34px system-ui, sans-serif'
  ctx.fillStyle = PAL.cream
  ctx.fillText('ЛАВКА ДИОГЕНА', VIEW_W / 2, P.y + 52)
  ctx.font = '600 15px system-ui, sans-serif'
  ctx.fillStyle = PAL.ochre
  ctx.fillText('ЧЕРЕПКОВ: ' + wallet + ' · цены окончательные, сдачи нет', VIEW_W / 2, P.y + 78)

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const y = SHOP_ROW_Y + i * SHOP_ROW_H
    const isSel = i === sel
    const affordable = r.cost > 0 && wallet >= r.cost
    if (isSel) {
      ctx.fillStyle = 'rgba(227, 169, 79, 0.12)'
      ctx.fillRect(P.x + 14, y - 6, P.w - 28, SHOP_ROW_H - 8)
      ctx.strokeStyle = PAL.ochre
      ctx.lineWidth = 2
      ctx.strokeRect(P.x + 14, y - 6, P.w - 28, SHOP_ROW_H - 8)
    }
    ctx.textAlign = 'left'
    ctx.font = '800 18px system-ui, sans-serif'
    ctx.fillStyle = isSel ? PAL.glow : PAL.cream
    ctx.fillText(r.name, P.x + 32, y + 16)
    ctx.font = '400 13px system-ui, sans-serif'
    ctx.fillStyle = 'rgba(243, 230, 200, 0.75)'
    ctx.fillText(r.desc, P.x + 32, y + 36)
    // пипсы уровня
    for (let k = 0; k < r.max; k++) {
      ctx.fillStyle = k < r.lvl ? PAL.ochre : 'rgba(243, 230, 200, 0.22)'
      ctx.fillRect(P.x + 340 + k * 16, y + 6, 12, 6)
    }
    ctx.textAlign = 'right'
    ctx.font = '800 17px system-ui, sans-serif'
    if (r.cost < 0) {
      ctx.fillStyle = 'rgba(243, 230, 200, 0.5)'
      ctx.fillText('ВЫКУПЛЕНО', P.x + P.w - 32, y + 22)
    } else {
      ctx.fillStyle = affordable ? PAL.glow : 'rgba(126, 47, 29, 0.95)'
      ctx.fillText(r.cost + ' чер.', P.x + P.w - 32, y + 22)
    }
  }

  ctx.textAlign = 'center'
  ctx.font = '600 15px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(243, 230, 200, 0.7)'
  ctx.fillText(
    coarse ? 'тап по строке — купить · тап мимо — выход' : '↑ ↓ и ENTER — купить · ESC — выход',
    VIEW_W / 2, P.y + P.h - 24,
  )
}

// Геометрия карточек левел-апа — общая для отрисовки и тач-попаданий.
export const CARD_W = 330
export const CARD_H = 230
export const CARD_GAP = 28
export const CARD_Y = 230

export function cardX(i: number): number {
  return (VIEW_W - (CARD_W * 3 + CARD_GAP * 2)) / 2 + i * (CARD_W + CARD_GAP)
}

export function drawLevelup(ctx: CanvasRenderingContext2D, w: World, choices: number[], sel: number, coarse: boolean): void {
  dim(ctx, 0.6)
  ctx.textAlign = 'center'
  ctx.font = '900 40px system-ui, sans-serif'
  ctx.fillStyle = PAL.cream
  ctx.fillText('СТАЛО ЯСНЕЕ', VIEW_W / 2, 150)
  ctx.font = '600 17px system-ui, sans-serif'
  ctx.fillStyle = PAL.ochre
  ctx.fillText('УРОВЕНЬ ' + w.level + ' — выберите одно', VIEW_W / 2, 182)

  const cw = CARD_W
  const ch = CARD_H
  const y0 = CARD_Y
  for (let i = 0; i < 3; i++) {
    const def = defByIndex(choices[i])
    const x = cardX(i)
    const isSel = i === sel
    ctx.save()
    if (isSel) {
      ctx.translate(x + cw / 2, y0 + ch / 2)
      ctx.scale(1.04, 1.04)
      ctx.translate(-(x + cw / 2), -(y0 + ch / 2))
    }
    ctx.fillStyle = 'rgba(26, 15, 10, 0.94)'
    ctx.beginPath()
    ctx.roundRect(x, y0, cw, ch, 12)
    ctx.fill()
    ctx.strokeStyle = isSel ? PAL.ochre : 'rgba(243, 230, 200, 0.45)'
    ctx.lineWidth = isSel ? 4 : 2
    ctx.stroke()
    // номер-горячая клавиша
    ctx.font = '700 15px system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(243, 230, 200, 0.5)'
    ctx.fillText(String(i + 1), x + 14, y0 + 24)
    drawIcon(ctx, def.id, x + cw / 2, y0 + 62, 52)
    ctx.textAlign = 'center'
    ctx.font = '800 21px system-ui, sans-serif'
    ctx.fillStyle = isSel ? PAL.glow : PAL.cream
    const cur = def.lvl(w)
    const tag = def.max <= 5 ? (cur > 0 ? '  ' + roman(cur + 1) : '') : ''
    ctx.fillText(def.name + tag, x + cw / 2, y0 + 118)
    ctx.font = '400 14px system-ui, sans-serif'
    ctx.fillStyle = 'rgba(243, 230, 200, 0.85)'
    wrapText(ctx, def.desc, x + cw / 2, y0 + 145, cw - 44, 19)
    // пипсы уровня
    if (def.max <= 5) {
      for (let k = 0; k < def.max; k++) {
        const px = x + cw / 2 - (def.max * 14) / 2 + k * 14
        ctx.fillStyle = k < cur ? PAL.ochre : 'rgba(243, 230, 200, 0.22)'
        ctx.fillRect(px, y0 + ch - 24, 10, 5)
      }
    }
    ctx.restore()
  }
  ctx.textAlign = 'center'
  ctx.font = '600 16px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(243, 230, 200, 0.7)'
  ctx.fillText(coarse ? 'тап по карте — взять' : '←  → и ENTER, или 1 / 2 / 3', VIEW_W / 2, y0 + ch + 46)
}

export function drawPause(ctx: CanvasRenderingContext2D, statLines: string[]): void {
  dim(ctx, 0.55)
  ctx.textAlign = 'center'
  ctx.font = '900 52px system-ui, sans-serif'
  ctx.fillStyle = PAL.cream
  ctx.fillText('ПЕРЕДЫШКА', VIEW_W / 2, 200)
  ctx.font = '400 18px system-ui, sans-serif'
  ctx.fillStyle = PAL.ochre
  ctx.fillText('Толпа подождёт. Ей не к спеху, вам — тем более.', VIEW_W / 2, 240)
  ctx.font = '600 16px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(243, 230, 200, 0.85)'
  for (let i = 0; i < statLines.length; i++) {
    ctx.fillText(statLines[i], VIEW_W / 2, 300 + i * 26)
  }
  ctx.font = '800 22px system-ui, sans-serif'
  ctx.fillStyle = PAL.glow
  ctx.fillText('ESC — ПРОДОЛЖИТЬ', VIEW_W / 2, 560)
}

export function drawEnd(ctx: CanvasRenderingContext2D, win: boolean, statLines: string[], time: number, coarse: boolean): void {
  dim(ctx, win ? 0.55 : 0.68)
  meander(ctx, 72, 0.35)
  ctx.textAlign = 'center'
  ctx.font = '900 62px system-ui, sans-serif'
  const title = win ? 'АЛЕКСАНДР ОТОШЁЛ' : 'ДИОГЕН ПАЛ'
  ctx.fillStyle = PAL.ink
  ctx.fillText(title, VIEW_W / 2 + 4, 178)
  ctx.fillStyle = win ? PAL.glow : PAL.cream
  ctx.fillText(title, VIEW_W / 2, 174)
  ctx.font = '500 20px system-ui, sans-serif'
  ctx.fillStyle = PAL.ochre
  ctx.fillText(
    win ? 'Солнце снова ничьё. Можно загорать.' : 'Бочка освободилась. Желающие — в очередь.',
    VIEW_W / 2, 218,
  )
  // первая строка — общие цифры, дальше — снаряжение в две колонки
  ctx.font = '600 18px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(243, 230, 200, 0.95)'
  if (statLines.length > 0) ctx.fillText(statLines[0], VIEW_W / 2, 274)
  ctx.font = '700 15px system-ui, sans-serif'
  ctx.fillStyle = PAL.ochre
  ctx.fillText('СНАРЯЖЕНИЕ', VIEW_W / 2, 322)
  ctx.font = '500 15px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(243, 230, 200, 0.85)'
  let li = 0
  for (let i = 0; i < statLines.length; i++) {
    const line = statLines[i]
    if (i === 0 || line === '' || line === 'СНАРЯЖЕНИЕ:') continue
    const col = li % 2
    const row = (li / 2) | 0
    ctx.fillText(line, VIEW_W / 2 + (col === 0 ? -160 : 160), 352 + row * 24)
    li++
  }
  const pulse = 0.6 + 0.4 * Math.sin(time * 4)
  ctx.globalAlpha = pulse
  ctx.font = '800 26px system-ui, sans-serif'
  ctx.fillStyle = PAL.glow
  ctx.fillText(coarse ? 'ТАП — ЕЩЁ РАЗ' : 'R / ENTER — ЕЩЁ РАЗ', VIEW_W / 2, 622)
  ctx.globalAlpha = 1
}

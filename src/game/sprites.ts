// Вся графика рисуется кодом в offscreen-канвасы один раз при старте.
// Стиль — чернофигурная вазопись: тёмные силуэты, охра и белый как акценты.

import { PAL } from '../config'
import { RNG } from '../engine/rng'

export interface Sprite {
  img: HTMLCanvasElement
  white: HTMLCanvasElement
  /** Точка привязки (центр) в пикселях канваса, и логический масштаб 2x. */
  ax: number
  ay: number
}

export interface Sprites {
  enemies: Sprite[]
  boss: Sprite
  dog: Sprite
  glow: HTMLCanvasElement
  gem: HTMLCanvasElement
  pattern: CanvasPattern | null
}

function mk(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  return [c, ctx]
}

type DrawFn = (c: CanvasRenderingContext2D, ink: string, ochre: string, cream: string) => void

/** Собирает спрайт в двух вариантах: обычный и белый (хит-флэш). 2x масштаб. */
function sprite(w: number, h: number, draw: DrawFn): Sprite {
  const [img, c1] = mk(w * 2, h * 2)
  c1.scale(2, 2)
  c1.translate(w / 2, h / 2)
  draw(c1, PAL.ink, PAL.ochre, PAL.cream)
  const [white, c2] = mk(w * 2, h * 2)
  c2.scale(2, 2)
  c2.translate(w / 2, h / 2)
  draw(c2, PAL.cream, PAL.cream, PAL.cream)
  return { img, white, ax: w / 2, ay: h / 2 }
}

// --- враги ---

// Торговец: согнулся под амфорой, семенит.
const drawMerchant: DrawFn = (c, ink, ochre, cream) => {
  c.fillStyle = ink
  // ноги в шаге
  c.beginPath()
  c.moveTo(-2, 2); c.lineTo(-7, 10); c.lineTo(-4.5, 10.5); c.lineTo(0, 4)
  c.lineTo(4, 10.5); c.lineTo(6.5, 9.5); c.lineTo(3, 2)
  c.closePath()
  c.fill()
  // корпус с наклоном вперёд
  c.beginPath()
  c.ellipse(0, -2, 5.5, 6.5, 0.35, 0, Math.PI * 2)
  c.fill()
  // голова
  c.beginPath()
  c.arc(4.5, -8.5, 3, 0, Math.PI * 2)
  c.fill()
  // амфора на плече
  c.save()
  c.translate(-2.5, -10)
  c.rotate(-0.5)
  c.beginPath()
  c.ellipse(0, 0, 3.2, 4.4, 0, 0, Math.PI * 2)
  c.fill()
  c.fillRect(-1.6, -6.2, 3.2, 2.4)
  c.fillStyle = ochre
  c.fillRect(-2.6, -1, 5.2, 1.1)
  c.restore()
  // повязка
  c.fillStyle = ochre
  c.fillRect(2.6, -9.4, 4, 1)
  // глаз
  c.fillStyle = cream
  c.fillRect(5.6, -9, 1.1, 1.1)
}

// Стражник: круглый щит, гребень, копьё.
const drawGuard: DrawFn = (c, ink, ochre, cream) => {
  // копьё
  c.strokeStyle = ink
  c.lineWidth = 1.4
  c.beginPath()
  c.moveTo(-9, 9)
  c.lineTo(10, -10)
  c.stroke()
  c.fillStyle = ink
  c.beginPath()
  c.moveTo(10, -10); c.lineTo(13, -13); c.lineTo(11.2, -8.4)
  c.closePath()
  c.fill()
  // ноги
  c.fillRect(-4, 6, 3, 6)
  c.fillRect(2, 6, 3, 6)
  // щит
  c.beginPath()
  c.arc(0, 0, 8.6, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = ochre
  c.lineWidth = 1.2
  c.beginPath()
  c.arc(0, 0, 6.6, 0, Math.PI * 2)
  c.stroke()
  c.fillStyle = cream
  c.beginPath()
  c.arc(0, 0, 1.7, 0, Math.PI * 2)
  c.fill()
  // шлем с гребнем
  c.fillStyle = ink
  c.beginPath()
  c.arc(0, -10, 3.4, Math.PI, 0)
  c.fill()
  c.fillStyle = ochre
  c.beginPath()
  c.moveTo(-4.5, -11.5)
  c.quadraticCurveTo(0, -17, 4.5, -11.5)
  c.quadraticCurveTo(0, -13.5, -4.5, -11.5)
  c.fill()
}

// Платоник: широкая мантия, борода, указует перстом в небо (на мир идей).
const drawPlatonist: DrawFn = (c, ink, ochre, cream) => {
  c.fillStyle = ink
  // мантия-колокол
  c.beginPath()
  c.moveTo(-13, 14)
  c.quadraticCurveTo(-11, -6, -5, -10)
  c.lineTo(5, -10)
  c.quadraticCurveTo(11, -6, 13, 14)
  c.closePath()
  c.fill()
  // складки
  c.strokeStyle = ochre
  c.lineWidth = 1
  c.beginPath(); c.moveTo(-5, 0); c.lineTo(-7, 13); c.stroke()
  c.beginPath(); c.moveTo(2, -2); c.lineTo(3, 13); c.stroke()
  // голова с бородой
  c.fillStyle = ink
  c.beginPath()
  c.arc(0, -13, 4.2, 0, Math.PI * 2)
  c.fill()
  c.beginPath()
  c.moveTo(-3.4, -11); c.lineTo(0, -4.5); c.lineTo(3.4, -11)
  c.closePath()
  c.fill()
  // рука вверх + перст
  c.beginPath()
  c.moveTo(6, -9)
  c.quadraticCurveTo(10, -13, 10.5, -18)
  c.lineTo(12.5, -17.5)
  c.quadraticCurveTo(12, -12, 8.5, -7.5)
  c.closePath()
  c.fill()
  c.fillStyle = cream
  c.fillRect(10.6, -20.2, 1.6, 3)
  // лента на голове
  c.fillStyle = ochre
  c.fillRect(-4, -15, 8, 1.2)
}

// Софист: тощий, со свитком, бородка клином.
const drawSophist: DrawFn = (c, ink, ochre, cream) => {
  c.fillStyle = ink
  // узкий хитон
  c.beginPath()
  c.moveTo(-5, 12)
  c.lineTo(-3.5, -6)
  c.lineTo(3.5, -6)
  c.lineTo(5, 12)
  c.closePath()
  c.fill()
  // голова
  c.beginPath()
  c.arc(0, -9, 3.4, 0, Math.PI * 2)
  c.fill()
  // бородка
  c.beginPath()
  c.moveTo(-1.8, -6.8); c.lineTo(0.6, -2.6); c.lineTo(2.6, -6.6)
  c.closePath()
  c.fill()
  // рука со свитком
  c.beginPath()
  c.moveTo(2, -4)
  c.lineTo(9, -7)
  c.lineTo(9.5, -5.2)
  c.lineTo(2.5, -2.2)
  c.closePath()
  c.fill()
  c.fillStyle = cream
  c.fillRect(7.6, -9.6, 4.6, 2)
  c.fillStyle = ochre
  c.fillRect(7.6, -9.6, 1, 2)
  c.fillRect(11.2, -9.6, 1, 2)
}

// Пёс Диогена.
const drawDog: DrawFn = (c, ink, ochre, cream) => {
  c.fillStyle = ink
  // корпус
  c.beginPath()
  c.ellipse(0, 0, 7, 3.6, 0, 0, Math.PI * 2)
  c.fill()
  // голова
  c.beginPath()
  c.arc(7, -2.4, 2.8, 0, Math.PI * 2)
  c.fill()
  // морда + ухо
  c.beginPath()
  c.moveTo(8.6, -2.6); c.lineTo(11.4, -1.6); c.lineTo(8.8, -0.8)
  c.closePath()
  c.fill()
  c.beginPath()
  c.moveTo(5.6, -4.6); c.lineTo(6.6, -7); c.lineTo(7.8, -4.8)
  c.closePath()
  c.fill()
  // лапы
  c.fillRect(-5.5, 2, 1.8, 4.4)
  c.fillRect(-1.5, 2.4, 1.8, 4)
  c.fillRect(2.5, 2, 1.8, 4.4)
  c.fillRect(5.2, 2.4, 1.6, 3.6)
  // хвост крючком
  c.strokeStyle = ink
  c.lineWidth = 1.6
  c.beginPath()
  c.moveTo(-6.5, -1)
  c.quadraticCurveTo(-10, -4, -8.5, -6.5)
  c.stroke()
  // ошейник
  c.fillStyle = ochre
  c.fillRect(4.6, -1.4, 1.4, 2.6)
  // глаз
  c.fillStyle = cream
  c.fillRect(7.4, -3.2, 1, 1)
}

// Сам Платон: платоник в полтора роста, с лавром и свитком «Государства».
const drawPlato: DrawFn = (c, ink, ochre, cream) => {
  c.save()
  c.scale(1.55, 1.55)
  drawPlatonist(c, ink, ochre, cream)
  c.restore()
  // лавровый венок
  c.strokeStyle = ochre
  c.lineWidth = 2.2
  c.beginPath()
  c.arc(0, -20, 8.4, Math.PI * 0.95, Math.PI * 2.05)
  c.stroke()
  c.fillStyle = ochre
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (1 + i * 0.25)
    c.beginPath()
    c.ellipse(Math.cos(a) * 8.4, -20 + Math.sin(a) * 8.4, 2.6, 1.4, a + Math.PI / 2, 0, Math.PI * 2)
    c.fill()
  }
  // свиток под мышкой
  c.fillStyle = cream
  c.fillRect(-16, 2, 11, 4.6)
  c.fillStyle = ochre
  c.fillRect(-16, 2, 2.2, 4.6)
  c.fillRect(-7.2, 2, 2.2, 4.6)
}

// Александр: гребень, плащ, меч. Крупный.
const drawBoss: DrawFn = (c, ink, ochre, cream) => {
  // плащ за спиной
  c.fillStyle = '#3a2014'
  c.beginPath()
  c.moveTo(-8, -18)
  c.quadraticCurveTo(-26, 0, -20, 26)
  c.lineTo(-6, 20)
  c.closePath()
  c.fill()
  c.fillStyle = ink
  // ноги в стойке
  c.beginPath()
  c.moveTo(-9, 8); c.lineTo(-13, 27); c.lineTo(-7.5, 27.5); c.lineTo(-3, 12)
  c.closePath(); c.fill()
  c.beginPath()
  c.moveTo(9, 8); c.lineTo(13, 27); c.lineTo(7.5, 27.5); c.lineTo(3, 12)
  c.closePath(); c.fill()
  // поножи
  c.fillStyle = cream
  c.fillRect(-12.2, 18, 4, 1.6)
  c.fillRect(8.2, 18, 4, 1.6)
  // торс-кираса
  c.fillStyle = ink
  c.beginPath()
  c.moveTo(-11, 10)
  c.quadraticCurveTo(-13, -8, -7, -13)
  c.lineTo(7, -13)
  c.quadraticCurveTo(13, -8, 11, 10)
  c.closePath()
  c.fill()
  // мускулы кирасы
  c.strokeStyle = ochre
  c.lineWidth = 1.4
  c.beginPath(); c.moveTo(-6, -2); c.quadraticCurveTo(0, 2, 6, -2); c.stroke()
  c.beginPath(); c.moveTo(-5, 5); c.quadraticCurveTo(0, 8, 5, 5); c.stroke()
  // голова в шлеме
  c.fillStyle = ink
  c.beginPath()
  c.arc(0, -19, 6, 0, Math.PI * 2)
  c.fill()
  // забрало-прорезь
  c.fillStyle = cream
  c.fillRect(1.5, -21, 4.6, 1.4)
  // гребень
  c.fillStyle = ochre
  c.beginPath()
  c.moveTo(-9, -22)
  c.quadraticCurveTo(0, -34, 9, -22)
  c.quadraticCurveTo(0, -26, -9, -22)
  c.closePath()
  c.fill()
  // меч в правой руке
  c.fillStyle = ink
  c.beginPath()
  c.moveTo(10, -6); c.lineTo(17, -2); c.lineTo(15.5, 1); c.lineTo(9, -2.5)
  c.closePath()
  c.fill()
  c.fillStyle = cream
  c.beginPath()
  c.moveTo(16, -3.5); c.lineTo(27, 2.5); c.lineTo(25.6, 5.2); c.lineTo(14.8, -0.8)
  c.closePath()
  c.fill()
}

function makeGlow(): HTMLCanvasElement {
  const [cv, c] = mk(256, 256)
  const g = c.createRadialGradient(128, 128, 8, 128, 128, 126)
  g.addColorStop(0, 'rgba(255, 224, 170, 0.65)')
  g.addColorStop(0.55, 'rgba(255, 205, 130, 0.28)')
  g.addColorStop(1, 'rgba(255, 190, 110, 0)')
  c.fillStyle = g
  c.fillRect(0, 0, 256, 256)
  return cv
}

function makeGem(): HTMLCanvasElement {
  const [cv, c] = mk(24, 24)
  c.translate(12, 12)
  c.rotate(0.5)
  c.fillStyle = PAL.olive
  c.beginPath()
  c.ellipse(0, 0, 4, 5.6, 0, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = PAL.ink
  c.lineWidth = 1.4
  c.stroke()
  c.fillStyle = PAL.cream
  c.beginPath()
  c.ellipse(-1.2, -1.8, 1, 1.6, 0.4, 0, Math.PI * 2)
  c.fill()
  // черешок
  c.strokeStyle = PAL.ink
  c.lineWidth = 1.2
  c.beginPath()
  c.moveTo(0, -5.4)
  c.quadraticCurveTo(2.4, -7.4, 4, -7)
  c.stroke()
  return cv
}

/** Тайл фона: терракота, пятна обжига, меандр, редкие силуэты утвари. */
function makePattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const S = 512
  const [cv, c] = mk(S, S)
  const rng = new RNG(20260611)
  c.fillStyle = PAL.bg
  c.fillRect(0, 0, S, S)
  // неровность обжига
  for (let i = 0; i < 60; i++) {
    const x = rng.next() * S
    const y = rng.next() * S
    const r = 12 + rng.next() * 38
    c.fillStyle = rng.next() < 0.5 ? 'rgba(0,0,0,0.022)' : 'rgba(255,230,200,0.02)'
    c.beginPath()
    // рисуем с заворотом на края, чтобы тайл сшивался
    for (let ox = -S; ox <= S; ox += S) {
      for (let oy = -S; oy <= S; oy += S) {
        c.moveTo(x + ox + r, y + oy)
        c.arc(x + ox, y + oy, r, 0, Math.PI * 2)
      }
    }
    c.fill()
  }
  // меандровая лента (горизонтальная, тайлится по x)
  const drawMeander = (y: number) => {
    c.strokeStyle = 'rgba(33, 21, 16, 0.16)'
    c.lineWidth = 3
    const u = 32
    c.beginPath()
    for (let x = 0; x < S; x += u) {
      c.moveTo(x, y + 10)
      c.lineTo(x, y - 10)
      c.lineTo(x + u * 0.72, y - 10)
      c.lineTo(x + u * 0.72, y + 2)
      c.lineTo(x + u * 0.34, y + 2)
      c.lineTo(x + u * 0.34, y - 4)
    }
    c.stroke()
    c.strokeStyle = 'rgba(33, 21, 16, 0.12)'
    c.lineWidth = 2
    c.beginPath()
    c.moveTo(0, y - 16); c.lineTo(S, y - 16)
    c.moveTo(0, y + 16); c.lineTo(S, y + 16)
    c.stroke()
  }
  drawMeander(96)
  drawMeander(352)
  // редкая утварь: амфоры и оливковые веточки
  for (let i = 0; i < 7; i++) {
    const x = rng.next() * S
    const y = rng.next() * S
    c.save()
    c.translate(x, y)
    c.rotate(rng.next() * 0.6 - 0.3)
    c.globalAlpha = 0.065
    c.fillStyle = PAL.ink
    if (rng.next() < 0.5) {
      // амфора
      c.beginPath()
      c.ellipse(0, 0, 9, 13, 0, 0, Math.PI * 2)
      c.fill()
      c.fillRect(-4, -19, 8, 7)
      c.fillRect(-7, -21, 14, 3)
    } else {
      // веточка
      c.strokeStyle = PAL.ink
      c.lineWidth = 2.5
      c.beginPath()
      c.moveTo(-14, 6)
      c.quadraticCurveTo(0, -8, 16, -4)
      c.stroke()
      for (let k = 0; k < 5; k++) {
        const t = k / 4
        c.beginPath()
        c.ellipse(-12 + t * 26, 2 - t * 8, 2, 3.6, 0.7 - t, 0, Math.PI * 2)
        c.fill()
      }
    }
    c.restore()
  }
  return ctx.createPattern(cv, 'repeat')
}

export function buildSprites(ctx: CanvasRenderingContext2D): Sprites {
  return {
    enemies: [
      sprite(34, 34, drawMerchant),
      sprite(34, 38, drawGuard),
      sprite(46, 46, drawPlatonist),
      sprite(34, 34, drawSophist),
      sprite(72, 72, drawPlato),
    ],
    boss: sprite(76, 80, drawBoss),
    dog: sprite(28, 22, drawDog),
    glow: makeGlow(),
    gem: makeGem(),
    pattern: makePattern(ctx),
  }
}

// Вся графика рисуется кодом в offscreen-канвасы один раз при старте.
// Стиль — чернофигурная вазопись: тёмные силуэты, охра и белый как акценты.

import { PAL } from '../config'
import { RNG } from '../engine/rng'

export interface Sprite {
  /** Два кадра походки. */
  img: HTMLCanvasElement[]
  white: HTMLCanvasElement[]
  /** Точка привязки (центр) в логических пикселях. */
  ax: number
  ay: number
  /** Суперсэмплинг пре-рендера: канвас в ss раз больше логики. */
  ss: number
}

export interface Sprites {
  enemies: Sprite[]
  boss: Sprite
  dog: Sprite
  glow: HTMLCanvasElement
  gem: HTMLCanvasElement
  spit: HTMLCanvasElement
  /** Реквизит агоры: колонна, герма, лежащая амфора. */
  props: HTMLCanvasElement[]
  pattern: CanvasPattern | null
}

function mk(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  return [c, ctx]
}

// st — фаза шага: +1 / −1 (зеркалит постановку ног между кадрами).
// red — «пурпур» вазописи (added red): гребни, ленты, кайма.
type DrawFn = (c: CanvasRenderingContext2D, ink: string, ochre: string, cream: string, red: string, st: number) => void

const SS = 3 // суперсэмплинг пре-рендера: резкость на больших экранах

/** Собирает спрайт: 2 кадра походки × (обычный + белый хит-флэш). */
function sprite(w: number, h: number, draw: DrawFn): Sprite {
  const img: HTMLCanvasElement[] = []
  const white: HTMLCanvasElement[] = []
  for (let f = 0; f < 2; f++) {
    const st = f === 0 ? 1 : -1
    const [cv1, c1] = mk(w * SS, h * SS)
    c1.scale(SS, SS)
    c1.translate(w / 2, h / 2)
    draw(c1, PAL.ink, PAL.ochre, PAL.cream, PAL.blood, st)
    img.push(cv1)
    const [cv2, c2] = mk(w * SS, h * SS)
    c2.scale(SS, SS)
    c2.translate(w / 2, h / 2)
    draw(c2, PAL.cream, PAL.cream, PAL.cream, PAL.cream, st)
    white.push(cv2)
  }
  return { img, white, ax: w / 2, ay: h / 2, ss: SS }
}

// --- враги ---

// Профильная голова в духе вазописи: лоб-нос клином, борода, глаз-точка.
function head(c: CanvasRenderingContext2D, ink: string, cream: string, x: number, y: number, r: number, beard: number): void {
  c.fillStyle = ink
  c.beginPath()
  c.arc(x, y, r, 0, Math.PI * 2)
  c.fill()
  // нос-клин вперёд (фигуры ходят «вправо» в базовой ориентации)
  c.beginPath()
  c.moveTo(x + r * 0.55, y - r * 0.55)
  c.lineTo(x + r * 1.45, y + r * 0.1)
  c.lineTo(x + r * 0.45, y + r * 0.45)
  c.closePath()
  c.fill()
  if (beard > 0) {
    c.beginPath()
    c.moveTo(x - r * 0.7, y + r * 0.5)
    c.quadraticCurveTo(x, y + r * 0.8 + beard, x + r * 0.9, y + r * 0.4)
    c.closePath()
    c.fill()
  }
  c.fillStyle = cream
  c.fillRect(x + r * 0.32, y - r * 0.34, r * 0.3, r * 0.3)
}

// Пунктирная кайма по подолу — фирменная деталь росписи.
function hem(c: CanvasRenderingContext2D, color: string, x0: number, x1: number, y: number, step = 2.6): void {
  c.fillStyle = color
  for (let x = x0; x < x1; x += step) c.fillRect(x, y, step * 0.55, 1)
}

// Торговец: в эксомисе (одно плечо голое), согнулся под амфорой, семенит.
const drawMerchant: DrawFn = (c, ink, ochre, cream, red, st) => {
  c.save()
  c.scale(1.16, 1.16)
  c.fillStyle = ink
  // ноги в шаге, с икрами
  c.beginPath()
  c.moveTo(-1.5, 1)
  c.quadraticCurveTo(-5 * st - 2, 5, -6.5 * st - 1.5, 9.6)
  c.lineTo(-3.6 * st - 1.5, 10.4)
  c.quadraticCurveTo(-1.5 * st, 5.5, 0.5, 3)
  c.moveTo(2.5, 1.5)
  c.quadraticCurveTo(4.5 * st + 1, 5.5, 5.6 * st + 1.5, 10)
  c.lineTo(7.8 * st + 1.5, 9)
  c.quadraticCurveTo(4.5 * st + 2.5, 4, 3.5, 1)
  c.closePath()
  c.fill()
  // насечка икр
  c.strokeStyle = ochre
  c.lineWidth = 0.55
  c.beginPath(); c.moveTo(-5.4 * st - 1.7, 6.2); c.quadraticCurveTo(-5.9 * st - 1.7, 7.8, -5.6 * st - 1.6, 9.2); c.stroke()
  c.beginPath(); c.moveTo(4.7 * st + 1.6, 6.4); c.quadraticCurveTo(5.2 * st + 1.7, 7.8, 5.1 * st + 1.6, 9.4); c.stroke()
  // сандалии с ремешком
  c.fillStyle = ochre
  c.fillRect(-6.5 * st - 2.6, 9.6, 3.4, 1.2)
  c.fillRect(5.6 * st + 0.6, 9.2, 3.4, 1.2)
  c.strokeStyle = ochre
  c.lineWidth = 0.5
  c.beginPath(); c.moveTo(-5.2 * st - 1.9, 8.4); c.lineTo(-6 * st - 2.2, 9.8); c.stroke()
  c.beginPath(); c.moveTo(6.4 * st + 1.4, 8); c.lineTo(7 * st + 1.9, 9.4); c.stroke()
  // корпус-эксомис с наклоном вперёд
  c.fillStyle = ink
  c.beginPath()
  c.moveTo(-5, 2.5)
  c.quadraticCurveTo(-6, -5, -1.5, -7.5)
  c.lineTo(4, -6.5)
  c.quadraticCurveTo(5.5, -2, 4.5, 2.5)
  c.closePath()
  c.fill()
  // голое плечо и спина: мускульная насечка
  c.strokeStyle = ochre
  c.lineWidth = 0.7
  c.beginPath(); c.moveTo(-4.4, -3.6); c.quadraticCurveTo(-2.6, -6.2, 0.6, -6.9); c.stroke()
  c.beginPath(); c.moveTo(2.6, -5.4); c.quadraticCurveTo(3.8, -3.8, 3.9, -1.8); c.stroke()
  // складки туники
  c.beginPath(); c.moveTo(-2.5, -4); c.lineTo(-3.2, 1.8); c.stroke()
  c.beginPath(); c.moveTo(0.5, -4.5); c.lineTo(0.2, 1.8); c.stroke()
  // красная кайма пояса + пунктир подола
  c.fillStyle = red
  c.fillRect(-4.7, 0.2, 9, 0.9)
  hem(c, cream, -4.8, 4.4, 1.6)
  // голова в профиль
  head(c, ink, cream, 4.2, -9.2, 2.9, 1.6)
  // красная повязка
  c.fillStyle = red
  c.fillRect(1.8, -10.6, 4.6, 1)
  // рука придерживает амфору
  c.strokeStyle = ink
  c.lineWidth = 1.7
  c.beginPath()
  c.moveTo(1.5, -6)
  c.quadraticCurveTo(-1, -9.5, -2.5, -11.5)
  c.stroke()
  // амфора на плече (покачивается в шаге)
  c.save()
  c.translate(-2.8, -11)
  c.rotate(-0.5 + st * 0.06)
  c.fillStyle = ink
  c.beginPath()
  c.ellipse(0, 0, 3.3, 4.6, 0, 0, Math.PI * 2)
  c.fill()
  c.fillRect(-1.7, -6.6, 3.4, 2.6)
  c.fillRect(-2.8, -7.2, 5.6, 1.2)
  // ручки
  c.strokeStyle = ink
  c.lineWidth = 1
  c.beginPath(); c.moveTo(-3, -5.4); c.quadraticCurveTo(-4.6, -3.4, -3.1, -1.4); c.stroke()
  c.beginPath(); c.moveTo(3, -5.4); c.quadraticCurveTo(4.6, -3.4, 3.1, -1.4); c.stroke()
  // роспись на тулове: красный поясок и кремовый зигзаг
  c.fillStyle = red
  c.fillRect(-2.9, -1.4, 5.8, 1.2)
  c.strokeStyle = cream
  c.lineWidth = 0.6
  c.beginPath()
  for (let i = 0; i < 4; i++) {
    c.moveTo(-2.5 + i * 1.5, 1.3)
    c.lineTo(-1.8 + i * 1.5, 0.3)
    c.lineTo(-1.1 + i * 1.5, 1.3)
  }
  c.stroke()
  // блик обжига на тулове
  c.strokeStyle = cream
  c.lineWidth = 0.5
  c.beginPath()
  c.ellipse(-1, -0.6, 2.2, 3.4, 0, Math.PI * 0.9, Math.PI * 1.45)
  c.stroke()
  c.restore()
  c.restore()
}

// Стражник-гоплит: коринфский шлем, круглый щит со звездой, копьё, поножи.
const drawGuard: DrawFn = (c, ink, ochre, cream, red, st) => {
  c.save()
  c.scale(1.16, 1.16)
  // копьё за щитом, с бронзовым подтоком
  c.strokeStyle = ink
  c.lineWidth = 1.4
  c.beginPath()
  c.moveTo(-9, 9)
  c.lineTo(10, -10)
  c.stroke()
  c.fillStyle = ink
  c.beginPath()
  c.moveTo(10, -10); c.lineTo(13.2, -13.4); c.lineTo(11.2, -8.4)
  c.closePath()
  c.fill()
  c.strokeStyle = ochre
  c.lineWidth = 0.6
  c.beginPath(); c.moveTo(11, -11); c.lineTo(12.4, -12.4); c.stroke()
  c.fillStyle = ochre
  c.fillRect(-10.2, 8.6, 2.2, 1.4) // подток
  // ноги в шаге с поножами
  c.fillStyle = ink
  c.beginPath()
  c.moveTo(-4 - st, 5)
  c.quadraticCurveTo(-4.6 - st, 8.5, -4 - st, 11.6)
  c.lineTo(-1.4 - st, 11.6)
  c.quadraticCurveTo(-1 - st, 8, -1.2, 5)
  c.moveTo(2 + st, 5)
  c.quadraticCurveTo(1.6 + st, 8.5, 2.2 + st, 11.4 - st * 0.5)
  c.lineTo(4.8 + st, 11.4 - st * 0.5)
  c.quadraticCurveTo(5 + st, 8, 4.6, 5)
  c.closePath()
  c.fill()
  // поножи-блики
  c.fillStyle = cream
  c.fillRect(-3.9 - st, 7.4, 1, 3.4)
  c.fillRect(2.4 + st, 7.2 - st * 0.4, 1, 3.4)
  // птеруги с красными кончиками
  c.fillStyle = ink
  for (let i = 0; i < 4; i++) {
    c.fillRect(-4.4 + i * 2.5, 3.4, 1.7, 3.4)
  }
  c.fillStyle = red
  for (let i = 0; i < 4; i++) c.fillRect(-4.3 + i * 2.5, 5.9, 1.5, 1)
  // щит-гоплон: красный обод, охровое кольцо, выпуклый блик
  c.fillStyle = ink
  c.beginPath()
  c.arc(0, 0, 8.8, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = red
  c.lineWidth = 1.3
  c.beginPath()
  c.arc(0, 0, 7.9, 0, Math.PI * 2)
  c.stroke()
  c.strokeStyle = ochre
  c.lineWidth = 1
  c.beginPath()
  c.arc(0, 0, 6.4, 0, Math.PI * 2)
  c.stroke()
  // звезда Аргоса
  c.fillStyle = cream
  c.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const r = i % 2 === 0 ? 3.6 : 1.4
    const px = Math.cos(a) * r
    const py = Math.sin(a) * r
    if (i === 0) c.moveTo(px, py)
    else c.lineTo(px, py)
  }
  c.closePath()
  c.fill()
  // блик выпуклости (полумесяц сверху)
  c.strokeStyle = cream
  c.lineWidth = 0.8
  c.beginPath()
  c.arc(-1.2, -1.4, 7, Math.PI * 1.08, Math.PI * 1.62)
  c.stroke()
  // коринфский шлем в профиль: купол, нащёчник, прорезь глаза
  c.fillStyle = ink
  c.beginPath()
  c.moveTo(-3.4, -9)
  c.quadraticCurveTo(-3.6, -13.6, 0.2, -13.8)
  c.quadraticCurveTo(4, -13.6, 4.2, -10.2)
  c.lineTo(4.6, -8)   // нащёчник вперёд
  c.lineTo(2.6, -7.4)
  c.lineTo(2.2, -8.8)
  c.lineTo(-3.4, -8.6)
  c.closePath()
  c.fill()
  // блик купола и прорезь глаза
  c.strokeStyle = ochre
  c.lineWidth = 0.6
  c.beginPath()
  c.moveTo(-2.6, -12.2)
  c.quadraticCurveTo(0, -13.4, 2.6, -12.6)
  c.stroke()
  c.fillStyle = cream
  c.fillRect(2.5, -10.6, 1.7, 1)
  // красный гребень из конского волоса (колышется)
  c.fillStyle = red
  c.beginPath()
  c.moveTo(-5.5, -12.5)
  c.quadraticCurveTo(0 + st, -19, 5.5, -12.8)
  c.quadraticCurveTo(0, -14.8, -5.5, -12.5)
  c.closePath()
  c.fill()
  c.strokeStyle = ink
  c.lineWidth = 0.6
  for (let i = 0; i < 4; i++) {
    c.beginPath()
    c.moveTo(-3.5 + i * 2.4, -13.4)
    c.lineTo(-3 + i * 2.4 + st * 0.5, -16.4 - (i % 2))
    c.stroke()
  }
  c.restore()
}

// Платоник: тяжёлый гиматий с глубокими складками, борода, перст к миру идей.
const drawPlatonist: DrawFn = (c, ink, ochre, cream, red, st) => {
  c.save()
  c.scale(1.13, 1.13)
  c.fillStyle = ink
  // гиматий-колокол (подол колышется)
  c.beginPath()
  c.moveTo(-13 - st, 14)
  c.quadraticCurveTo(-12, -2, -7, -8)
  c.quadraticCurveTo(-3, -10.5, 0, -10.5)
  c.lineTo(5, -10)
  c.quadraticCurveTo(11, -6, 13 + st, 14)
  c.closePath()
  c.fill()
  // глубокие складки веером: охра + кремовая тень парой
  c.strokeStyle = ochre
  c.lineWidth = 1
  c.beginPath(); c.moveTo(-6, -3); c.quadraticCurveTo(-8 - st, 6, -8.5 - st, 13); c.stroke()
  c.beginPath(); c.moveTo(-1, -5); c.quadraticCurveTo(-1.5, 5, -2 - st * 0.5, 13.4); c.stroke()
  c.beginPath(); c.moveTo(3.5, -4); c.quadraticCurveTo(4.5, 5, 5 + st, 13); c.stroke()
  c.strokeStyle = cream
  c.lineWidth = 0.45
  c.beginPath(); c.moveTo(-5.2, -3); c.quadraticCurveTo(-7.2 - st, 6, -7.7 - st, 13); c.stroke()
  c.beginPath(); c.moveTo(-0.2, -5); c.quadraticCurveTo(-0.7, 5, -1.2 - st * 0.5, 13.4); c.stroke()
  c.beginPath(); c.moveTo(4.3, -4); c.quadraticCurveTo(5.3, 5, 5.8 + st, 13); c.stroke()
  // перекинутый через плечо край (диагональ) с красной полосой
  c.strokeStyle = cream
  c.lineWidth = 1.2
  c.beginPath()
  c.moveTo(-6.5, -7)
  c.quadraticCurveTo(2, -2, 9.5, 7)
  c.stroke()
  c.strokeStyle = red
  c.lineWidth = 0.8
  c.beginPath()
  c.moveTo(-7.2, -6.2)
  c.quadraticCurveTo(1.4, -1.2, 8.8, 8)
  c.stroke()
  // красная полоса над пунктирной каймой подола
  c.strokeStyle = red
  c.lineWidth = 0.9
  c.beginPath()
  c.moveTo(-11.6 - st, 11.2)
  c.quadraticCurveTo(0, 12.4, 11.8 + st, 11.2)
  c.stroke()
  hem(c, cream, -12 - st, 12.4 + st, 12.6, 3)
  // голова в профиль с длинной бородой
  head(c, ink, cream, 0.6, -13, 3.9, 3.4)
  // пряди бороды
  c.strokeStyle = ochre
  c.lineWidth = 0.5
  c.beginPath(); c.moveTo(-1.6, -11.2); c.quadraticCurveTo(-0.6, -9.4, 0.6, -8.8); c.stroke()
  c.beginPath(); c.moveTo(1.2, -10.8); c.quadraticCurveTo(2, -9.6, 2.8, -9.2); c.stroke()
  // красная лента-диадема
  c.fillStyle = red
  c.fillRect(-3.4, -15.4, 8, 1.2)
  // рука вверх + перст (чуть покачивается)
  c.fillStyle = ink
  c.save()
  c.rotate(st * 0.03)
  c.beginPath()
  c.moveTo(6, -9)
  c.quadraticCurveTo(10, -13, 10.5, -18)
  c.lineTo(12.5, -17.5)
  c.quadraticCurveTo(12, -12, 8.5, -7.5)
  c.closePath()
  c.fill()
  // насечка рукава
  c.strokeStyle = ochre
  c.lineWidth = 0.55
  c.beginPath(); c.moveTo(7.4, -9.4); c.quadraticCurveTo(10, -12.6, 10.7, -16.4); c.stroke()
  c.fillStyle = cream
  c.fillRect(10.6, -20.2, 1.6, 3)
  c.restore()
  c.restore()
}

// Софист: тощий ритор — хитон со складками, свиток, второй рукой вещает.
const drawSophist: DrawFn = (c, ink, ochre, cream, red, st) => {
  c.save()
  c.scale(1.16, 1.16)
  // развевающийся хвост гиматия за спиной (движение!)
  c.fillStyle = ink
  c.beginPath()
  c.moveTo(-3, -5)
  c.quadraticCurveTo(-8 - st, -2, -10.5 - st * 1.6, 3.5)
  c.quadraticCurveTo(-7.5, 3, -4.2, 0.5)
  c.closePath()
  c.fill()
  c.strokeStyle = ochre
  c.lineWidth = 0.6
  c.beginPath()
  c.moveTo(-4.4, -3.4)
  c.quadraticCurveTo(-7.8 - st, -0.8, -9.4 - st * 1.4, 2.6)
  c.stroke()
  // узкий хитон, подол в шаге
  c.fillStyle = ink
  c.beginPath()
  c.moveTo(-5 - st * 0.8, 12)
  c.quadraticCurveTo(-4.4, 2, -3.5, -6)
  c.lineTo(3.5, -6)
  c.quadraticCurveTo(4.6, 2, 5 + st * 0.8, 12)
  c.closePath()
  c.fill()
  // вертикальные складочки хитона
  c.strokeStyle = ochre
  c.lineWidth = 0.7
  c.beginPath(); c.moveTo(-2, -4); c.lineTo(-2.6 - st * 0.4, 11); c.stroke()
  c.beginPath(); c.moveTo(1.2, -4); c.lineTo(1.8 + st * 0.4, 11); c.stroke()
  c.strokeStyle = cream
  c.lineWidth = 0.4
  c.beginPath(); c.moveTo(-0.4, -4.4); c.lineTo(-0.6, 11); c.stroke()
  // красный шнур на поясе
  c.strokeStyle = red
  c.lineWidth = 0.9
  c.beginPath()
  c.moveTo(-3.8, -0.6)
  c.quadraticCurveTo(0, 0.6, 3.9, -0.6)
  c.stroke()
  hem(c, cream, -4.6 - st * 0.8, 4.6 + st * 0.8, 10.8, 2.2)
  // ступни
  c.fillStyle = ink
  c.fillRect(-4 - st * 1.4, 11.6, 2.6, 1.2)
  c.fillRect(1.6 + st * 1.4, 11.6, 2.6, 1.2)
  // голова в профиль с бородкой клином
  head(c, ink, cream, 0.4, -9.4, 3.1, 2)
  // залысина-лоб (софисту положено)
  c.fillStyle = ink
  c.beginPath()
  c.arc(-0.8, -11.2, 2, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = ochre
  c.lineWidth = 0.5
  c.beginPath()
  c.arc(-0.9, -11.4, 1.5, Math.PI * 1.1, Math.PI * 1.7)
  c.stroke()
  // рука со свитком (жестикулирует)
  c.fillStyle = ink
  c.save()
  c.rotate(st * 0.07)
  c.beginPath()
  c.moveTo(2, -4)
  c.lineTo(9, -7)
  c.lineTo(9.5, -5.2)
  c.lineTo(2.5, -2.2)
  c.closePath()
  c.fill()
  // свиток с красными навершиями
  c.fillStyle = cream
  c.fillRect(7.6, -9.6, 4.6, 2)
  c.strokeStyle = ochre
  c.lineWidth = 0.4
  c.beginPath(); c.moveTo(8.9, -9.4); c.lineTo(8.9, -7.8); c.moveTo(10.1, -9.4); c.lineTo(10.1, -7.8); c.stroke()
  c.fillStyle = red
  c.fillRect(7.3, -9.9, 1, 2.6)
  c.fillRect(11.5, -9.9, 1, 2.6)
  c.restore()
  // вторая рука открытой ладонью — «убеждает»
  c.strokeStyle = ink
  c.lineWidth = 1.5
  c.beginPath()
  c.moveTo(-2.6, -4.5)
  c.quadraticCurveTo(-6, -5.5 - st, -8, -8 - st * 1.5)
  c.stroke()
  c.fillStyle = ink
  c.beginPath()
  c.arc(-8.3, -8.4 - st * 1.5, 1.3, 0, Math.PI * 2)
  c.fill()
  c.restore()
}

// Пёс Диогена: лаконская борзая — поджарая, глубокая грудь, хвост серпом.
const drawDog: DrawFn = (c, ink, ochre, cream, red, st) => {
  c.save()
  c.scale(1.12, 1.12)
  c.fillStyle = ink
  // корпус: грудь глубокая, талия поджарая
  c.beginPath()
  c.moveTo(-6.8, -1.6)
  c.quadraticCurveTo(-4.4, -3.4, -0.5, -3.2)
  c.quadraticCurveTo(3.6, -3.4, 6.2, -3.6)
  c.quadraticCurveTo(7.4, -1, 6.4, 1.6)
  c.quadraticCurveTo(4, 3.4, 1.2, 2.6)   // живот подтянут
  c.quadraticCurveTo(-2.6, 1.4, -5.2, 2.2)
  c.quadraticCurveTo(-7.2, 0.8, -6.8, -1.6)
  c.closePath()
  c.fill()
  // голова на вытянутой шее
  c.beginPath()
  c.moveTo(5, -3.2)
  c.quadraticCurveTo(6.4, -4.6, 7.4, -5)
  c.arc(7.6, -3.4, 2.5, -Math.PI * 0.7, Math.PI * 0.5)
  c.closePath()
  c.fill()
  // острая морда + стоячее ухо
  c.beginPath()
  c.moveTo(9, -4.2); c.lineTo(12.2, -2.6); c.lineTo(9.2, -1.6)
  c.closePath()
  c.fill()
  c.beginPath()
  c.moveTo(6, -5.4); c.lineTo(7, -8); c.lineTo(8.4, -5.6)
  c.closePath()
  c.fill()
  // лапы в беге (две пары крест-накрест), тоньше у запястья
  c.beginPath()
  c.moveTo(-5.6 - st * 1.4, 1.6); c.lineTo(-4.4 - st * 1.7, 6.6); c.lineTo(-3.4 - st * 1.4, 6.5); c.lineTo(-3.6 - st * 1.2, 1.8)
  c.closePath(); c.fill()
  c.beginPath()
  c.moveTo(-1.4 + st * 1.2, 2); c.lineTo(-0.6 + st * 1.5, 6.3); c.lineTo(0.5 + st * 1.2, 6.2); c.lineTo(0.4 + st, 2.2)
  c.closePath(); c.fill()
  c.beginPath()
  c.moveTo(2.6 - st * 1.2, 1.8); c.lineTo(3.4 - st * 1.5, 6.4); c.lineTo(4.5 - st * 1.2, 6.3); c.lineTo(4.4 - st, 2)
  c.closePath(); c.fill()
  c.beginPath()
  c.moveTo(5.4 + st * 1.4, 1.4); c.lineTo(6.4 + st * 1.7, 5.8); c.lineTo(7.4 + st * 1.4, 5.7); c.lineTo(7 + st * 1.2, 1.4)
  c.closePath(); c.fill()
  // хвост серпом
  c.strokeStyle = ink
  c.lineWidth = 1.4
  c.beginPath()
  c.moveTo(-6.4, -0.6)
  c.quadraticCurveTo(-10.5, -3 + st, -9.5, -7 + st * 0.8)
  c.stroke()
  // насечка рёбер и бедра
  c.strokeStyle = ochre
  c.lineWidth = 0.5
  c.beginPath(); c.moveTo(1.6, -2.2); c.quadraticCurveTo(1.2, -0.4, 1.8, 1.4); c.stroke()
  c.beginPath(); c.arc(-4.2, 0, 2, -Math.PI * 0.4, Math.PI * 0.5); c.stroke()
  // красный ошейник
  c.fillStyle = red
  c.fillRect(4.8, -3.8, 1.4, 3)
  // глаз
  c.fillStyle = cream
  c.fillRect(7.8, -4.2, 1, 1)
  c.restore()
}

// Сам Платон: платоник в полтора роста, с лавром и свитком «Государства».
const drawPlato: DrawFn = (c, ink, ochre, cream, red, st) => {
  c.save()
  c.scale(1.55, 1.55)
  drawPlatonist(c, ink, ochre, cream, red, st)
  c.restore()
  // лавровый венок с прожилками — облегает затылок
  c.strokeStyle = ochre
  c.lineWidth = 2
  c.beginPath()
  c.arc(1, -23.6, 7.2, Math.PI * 0.9, Math.PI * 2.1)
  c.stroke()
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.98 + i * 0.26)
    const lx = 1 + Math.cos(a) * 7.2
    const ly = -23.6 + Math.sin(a) * 7.2
    c.fillStyle = ochre
    c.beginPath()
    c.ellipse(lx, ly, 2.5, 1.3, a + Math.PI / 2, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = ink
    c.lineWidth = 0.5
    c.beginPath()
    c.moveTo(lx - Math.cos(a + Math.PI / 2) * 2, ly - Math.sin(a + Math.PI / 2) * 2)
    c.lineTo(lx + Math.cos(a + Math.PI / 2) * 2, ly + Math.sin(a + Math.PI / 2) * 2)
    c.stroke()
  }
  // свиток «Государства» под мышкой, с красными навершиями
  c.fillStyle = cream
  c.fillRect(-18, 2.4, 12.5, 5)
  c.strokeStyle = ochre
  c.lineWidth = 0.6
  c.beginPath(); c.moveTo(-14.5, 3); c.lineTo(-14.5, 7); c.moveTo(-11.5, 3); c.lineTo(-11.5, 7); c.stroke()
  c.fillStyle = red
  c.fillRect(-18.6, 1.8, 2.2, 6.2)
  c.fillRect(-7.4, 1.8, 2.2, 6.2)
}

// Александр: красный плащ, гребень, мускульная кираса, меч. Крупный.
const drawBoss: DrawFn = (c, ink, ochre, cream, red, st) => {
  c.save()
  c.scale(1.08, 1.08)
  // красный плащ за спиной (колышется), с охровой подкладкой по краю
  c.fillStyle = red
  c.beginPath()
  c.moveTo(-7, -19)
  c.quadraticCurveTo(-27 - st * 2, -2, -21 - st * 3, 27)
  c.quadraticCurveTo(-14, 24, -6, 20)
  c.closePath()
  c.fill()
  c.strokeStyle = ochre
  c.lineWidth = 1.1
  c.beginPath()
  c.moveTo(-9.5, -16.5)
  c.quadraticCurveTo(-25 - st * 2, -1, -20 - st * 2.8, 25)
  c.stroke()
  // складки плаща
  c.strokeStyle = ink
  c.lineWidth = 0.9
  c.beginPath(); c.moveTo(-9, -13); c.quadraticCurveTo(-18 - st, 2, -16 - st * 2, 22); c.stroke()
  c.beginPath(); c.moveTo(-8, -8); c.quadraticCurveTo(-13.5 - st * 0.6, 4, -11.5 - st, 20); c.stroke()
  c.fillStyle = ink
  // ноги в стойке
  c.beginPath()
  c.moveTo(-9, 8); c.lineTo(-13 - st, 27); c.lineTo(-7.5 - st, 27.5); c.lineTo(-3, 12)
  c.closePath(); c.fill()
  c.beginPath()
  c.moveTo(9, 8); c.lineTo(13 + st, 27); c.lineTo(7.5 + st, 27.5); c.lineTo(3, 12)
  c.closePath(); c.fill()
  // поножи с бликом
  c.fillStyle = cream
  c.fillRect(-12.2 - st, 18, 4, 1.6)
  c.fillRect(8.2 + st, 18, 4, 1.6)
  c.strokeStyle = ochre
  c.lineWidth = 0.7
  c.beginPath(); c.moveTo(-11.4 - st, 20.4); c.lineTo(-10 - st, 25.6); c.stroke()
  c.beginPath(); c.moveTo(10.6 + st, 20.4); c.lineTo(11.4 + st, 25.6); c.stroke()
  // птеруги в два ряда, с красными кончиками
  c.fillStyle = ink
  for (let i = 0; i < 5; i++) {
    const px = -9 + i * 4
    c.fillRect(px, 8, 2.8, 6.5 + (i % 2) * 1.2)
  }
  c.fillStyle = red
  for (let i = 0; i < 5; i++) c.fillRect(-8.8 + i * 4, 13 + (i % 2) * 1.2, 2.4, 1.3)
  c.fillStyle = ochre
  for (let i = 0; i < 4; i++) c.fillRect(-6.8 + i * 4, 8.8, 2.2, 0.9)
  // торс-кираса
  c.fillStyle = ink
  c.beginPath()
  c.moveTo(-11, 10)
  c.quadraticCurveTo(-13, -8, -7, -13)
  c.lineTo(7, -13)
  c.quadraticCurveTo(13, -8, 11, 10)
  c.closePath()
  c.fill()
  // мускульная кираса: кремовая грудь, охровый пресс, золотой пояс с точками
  c.strokeStyle = cream
  c.lineWidth = 1.3
  c.beginPath(); c.moveTo(-6, -5); c.quadraticCurveTo(0, -1, 6, -5); c.stroke()
  c.strokeStyle = ochre
  c.lineWidth = 1.2
  c.beginPath(); c.moveTo(-4.5, 0.5); c.quadraticCurveTo(0, 3, 4.5, 0.5); c.stroke()
  c.beginPath(); c.moveTo(-4, 3.4); c.quadraticCurveTo(0, 5.6, 4, 3.4); c.stroke()
  c.beginPath(); c.moveTo(-2.5, -8); c.lineTo(-2.5, -1); c.stroke()
  c.beginPath(); c.moveTo(2.5, -8); c.lineTo(2.5, -1); c.stroke()
  // красные плечевые ремни
  c.strokeStyle = red
  c.lineWidth = 1.6
  c.beginPath(); c.moveTo(-6.5, -12.6); c.lineTo(-3.5, -8.4); c.stroke()
  c.beginPath(); c.moveTo(6.5, -12.6); c.lineTo(3.5, -8.4); c.stroke()
  // пояс
  c.fillStyle = ochre
  c.fillRect(-10, 7.4, 20, 2)
  c.fillStyle = ink
  for (let i = 0; i < 6; i++) c.fillRect(-8.4 + i * 3.3, 8, 1, 0.9)
  // коринфский шлем в профиль
  c.fillStyle = ink
  c.beginPath()
  c.moveTo(-5.8, -15)
  c.quadraticCurveTo(-6.4, -24, 0.4, -24.6)
  c.quadraticCurveTo(6.6, -24, 6.8, -18.6)
  c.lineTo(7.6, -14.6) // нащёчник
  c.lineTo(4.2, -13.6)
  c.lineTo(3.8, -15.2)
  c.lineTo(-5.8, -14.8)
  c.closePath()
  c.fill()
  // блик купола и прорезь глаза
  c.strokeStyle = ochre
  c.lineWidth = 0.8
  c.beginPath()
  c.moveTo(-4.6, -21.6)
  c.quadraticCurveTo(0, -23.8, 4.6, -21.8)
  c.stroke()
  c.fillStyle = cream
  c.fillRect(3.2, -19.4, 2.8, 1.3)
  // высокий красный гребень с тёмными прядями
  c.fillStyle = red
  c.beginPath()
  c.moveTo(-10.5, -22)
  c.quadraticCurveTo(0, -36 - st, 10.5, -22.5)
  c.quadraticCurveTo(0, -26.5, -10.5, -22)
  c.closePath()
  c.fill()
  c.strokeStyle = ink
  c.lineWidth = 0.8
  for (let i = 0; i < 6; i++) {
    c.beginPath()
    c.moveTo(-7.5 + i * 3, -23.6)
    c.quadraticCurveTo(-6.5 + i * 3, -27.5 - st, -5.5 + i * 3 + st * 0.6, -31 - (i % 2) * 1.4)
    c.stroke()
  }
  // меч в правой руке: рука, охровая гарда, кремовый клинок с долом
  c.fillStyle = ink
  c.beginPath()
  c.moveTo(10, -6); c.lineTo(17, -2); c.lineTo(15.5, 1); c.lineTo(9, -2.5)
  c.closePath()
  c.fill()
  c.fillStyle = ochre
  c.beginPath()
  c.moveTo(15.2, -4.6); c.lineTo(17.4, -3.4); c.lineTo(16.4, -1.2); c.lineTo(14.2, -2.4)
  c.closePath()
  c.fill()
  c.fillStyle = cream
  c.beginPath()
  c.moveTo(16.6, -3.2); c.lineTo(28, 3); c.lineTo(26.6, 5.7); c.lineTo(15.4, -0.5)
  c.closePath()
  c.fill()
  c.strokeStyle = ink
  c.lineWidth = 0.6
  c.beginPath()
  c.moveTo(17.6, -1.4)
  c.lineTo(26, 3.2)
  c.stroke()
  c.restore()
}

function makeGlow(): HTMLCanvasElement {
  const [cv, c] = mk(256, 256)
  // мягкие лучи под градиентом
  c.save()
  c.translate(128, 128)
  c.fillStyle = 'rgba(255, 210, 140, 0.05)'
  for (let i = 0; i < 12; i++) {
    c.rotate(Math.PI / 6)
    c.beginPath()
    c.moveTo(0, 0)
    c.lineTo(-13, -122)
    c.lineTo(13, -122)
    c.closePath()
    c.fill()
  }
  c.restore()
  const g = c.createRadialGradient(128, 128, 6, 128, 128, 126)
  g.addColorStop(0, 'rgba(255, 234, 190, 0.72)')
  g.addColorStop(0.3, 'rgba(255, 215, 150, 0.4)')
  g.addColorStop(0.62, 'rgba(255, 200, 125, 0.2)')
  g.addColorStop(1, 'rgba(255, 190, 110, 0)')
  c.fillStyle = g
  c.fillRect(0, 0, 256, 256)
  return cv
}

/** Плевок-комета: яркая голова, хвост гаснет влево. */
function makeSpit(): HTMLCanvasElement {
  const [cv, c] = mk(56, 24)
  const g = c.createLinearGradient(0, 12, 44, 12)
  g.addColorStop(0, 'rgba(227, 169, 79, 0)')
  g.addColorStop(0.55, 'rgba(243, 230, 200, 0.45)')
  g.addColorStop(1, 'rgba(243, 230, 200, 0.95)')
  c.fillStyle = g
  c.beginPath()
  c.moveTo(2, 12)
  c.quadraticCurveTo(26, 4, 44, 7)
  c.quadraticCurveTo(50, 12, 44, 17)
  c.quadraticCurveTo(26, 20, 2, 12)
  c.closePath()
  c.fill()
  c.fillStyle = '#fffbe9'
  c.beginPath()
  c.arc(44, 12, 5, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = 'rgba(243, 230, 200, 0.85)'
  c.beginPath()
  c.arc(44, 12, 7.5, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = '#ffffff'
  c.beginPath()
  c.arc(45.5, 11, 3.2, 0, Math.PI * 2)
  c.fill()
  return cv
}

function makeGem(): HTMLCanvasElement {
  const [cv, c] = mk(28, 28)
  c.translate(14, 15)
  c.rotate(0.5)
  // тень-подложка
  c.fillStyle = 'rgba(33, 21, 16, 0.25)'
  c.beginPath()
  c.ellipse(0.8, 1, 4.4, 5.9, 0, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = PAL.olive
  c.beginPath()
  c.ellipse(0, 0, 4.2, 5.8, 0, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = PAL.ink
  c.lineWidth = 1.4
  c.stroke()
  // глянец: длинный и точечный блики
  c.fillStyle = PAL.cream
  c.beginPath()
  c.ellipse(-1.3, -2, 1, 1.9, 0.4, 0, Math.PI * 2)
  c.fill()
  c.fillStyle = 'rgba(243, 230, 200, 0.55)'
  c.beginPath()
  c.arc(1.4, 2.2, 0.8, 0, Math.PI * 2)
  c.fill()
  // черешок и листик
  c.strokeStyle = PAL.ink
  c.lineWidth = 1.2
  c.beginPath()
  c.moveTo(0, -5.6)
  c.quadraticCurveTo(2.4, -7.6, 4, -7.2)
  c.stroke()
  c.fillStyle = PAL.olive
  c.save()
  c.translate(3.2, -7.6)
  c.rotate(-0.5)
  c.beginPath()
  c.ellipse(0, 0, 3, 1.2, 0, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = PAL.ink
  c.lineWidth = 0.8
  c.stroke()
  c.restore()
  return cv
}

/** Реквизит агоры — полупрозрачные силуэты, чтобы не путались с актёрами. */
function makeProps(): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = []
  // дорическая колонна (слегка побитая)
  {
    const [cv, c] = mk(72, 150)
    c.globalAlpha = 0.34
    c.fillStyle = PAL.ink
    c.fillRect(10, 132, 52, 10)   // стилобат
    c.fillRect(16, 124, 40, 8)
    // ствол с лёгким энтазисом
    c.beginPath()
    c.moveTo(20, 124)
    c.quadraticCurveTo(17.5, 76, 21, 28)
    c.lineTo(51, 28)
    c.quadraticCurveTo(54.5, 76, 52, 124)
    c.closePath()
    c.fill()
    c.fillStyle = PAL.bgDark
    c.globalAlpha = 0.5
    for (let i = 0; i < 5; i++) {
      const t = i / 4
      c.beginPath()
      c.moveTo(23 + t * 26, 30)
      c.quadraticCurveTo(21 + t * 30, 76, 23.5 + t * 25, 122)
      c.lineWidth = 2.2
      c.strokeStyle = PAL.bgDark
      c.stroke()
    }
    c.globalAlpha = 0.34
    c.fillStyle = PAL.ink
    c.fillRect(14, 18, 44, 10)    // эхин
    c.fillRect(10, 8, 52, 10)     // абака, скол справа
    c.clearRect(48, 8, 14, 7)
    // светлая грань (солнце слева)
    c.globalAlpha = 0.16
    c.fillStyle = PAL.cream
    c.fillRect(21, 30, 3, 92)
    out.push(cv)
  }
  // герма (столб с головой Гермеса)
  {
    const [cv, c] = mk(56, 120)
    c.globalAlpha = 0.34
    c.fillStyle = PAL.ink
    c.fillRect(12, 104, 32, 8)
    c.beginPath()
    c.moveTo(16, 104); c.lineTo(20, 30); c.lineTo(36, 30); c.lineTo(40, 104)
    c.closePath()
    c.fill()
    // голова в профиль с бородой
    c.beginPath()
    c.arc(28, 20, 10, 0, Math.PI * 2)
    c.fill()
    c.beginPath()
    c.moveTo(36, 16); c.lineTo(42, 20); c.lineTo(36, 23)
    c.closePath()
    c.fill()
    c.beginPath() // борода
    c.moveTo(21, 24); c.lineTo(28, 38); c.lineTo(35, 24)
    c.closePath()
    c.fill()
    // плечевые культяпки гермы
    c.fillRect(10, 32, 8, 5)
    c.fillRect(38, 32, 8, 5)
    c.globalAlpha = 0.5
    c.fillStyle = PAL.ochre
    c.fillRect(19, 12, 18, 2.4) // лента
    c.globalAlpha = 0.3
    c.fillStyle = PAL.cream
    c.fillRect(33, 17, 2, 2) // глаз
    out.push(cv)
  }
  // большая лежащая амфора с трещиной
  {
    const [cv, c] = mk(110, 64)
    c.globalAlpha = 0.34
    c.translate(55, 34)
    c.rotate(0.12)
    c.fillStyle = PAL.ink
    c.beginPath()
    c.ellipse(0, 0, 34, 19, 0, 0, Math.PI * 2)
    c.fill()
    c.fillRect(30, -8, 16, 16) // горло
    c.fillRect(44, -11, 6, 22) // венчик
    // ручка дугой
    c.strokeStyle = PAL.ink
    c.lineWidth = 4
    c.beginPath()
    c.arc(24, -14, 10, Math.PI * 0.9, Math.PI * 1.9)
    c.stroke()
    c.globalAlpha = 0.55
    c.strokeStyle = PAL.ochre
    c.lineWidth = 2.4
    c.beginPath()
    c.ellipse(0, 0, 24, 12, 0, 0.6, 2.5)
    c.stroke()
    // меандровый поясок на тулове
    c.globalAlpha = 0.4
    c.strokeStyle = PAL.cream
    c.lineWidth = 1.6
    c.beginPath()
    for (let x = -18; x < 14; x += 8) {
      c.moveTo(x, 6)
      c.lineTo(x, 2)
      c.lineTo(x + 5.5, 2)
      c.lineTo(x + 5.5, 4.6)
    }
    c.stroke()
    c.globalAlpha = 0.6
    c.strokeStyle = PAL.bg
    c.lineWidth = 2
    c.beginPath()
    c.moveTo(-20, -14); c.lineTo(-12, -2); c.lineTo(-18, 8)
    c.stroke()
    out.push(cv)
  }
  // бронзовый треножник-котёл (награда агонов)
  {
    const [cv, c] = mk(64, 110)
    c.globalAlpha = 0.34
    c.translate(32, 0)
    c.fillStyle = PAL.ink
    // чаша
    c.beginPath()
    c.moveTo(-22, 28)
    c.quadraticCurveTo(-24, 46, 0, 50)
    c.quadraticCurveTo(24, 46, 22, 28)
    c.closePath()
    c.fill()
    c.fillRect(-24, 24, 48, 6) // венец
    // кольца-ручки
    c.strokeStyle = PAL.ink
    c.lineWidth = 3
    c.beginPath(); c.arc(-17, 20, 6, 0, Math.PI * 2); c.stroke()
    c.beginPath(); c.arc(17, 20, 6, 0, Math.PI * 2); c.stroke()
    // три ноги (две видны полностью)
    c.fillStyle = PAL.ink
    c.beginPath()
    c.moveTo(-18, 48); c.lineTo(-22, 92); c.lineTo(-15, 92); c.lineTo(-12, 50)
    c.closePath(); c.fill()
    c.beginPath()
    c.moveTo(18, 48); c.lineTo(22, 92); c.lineTo(15, 92); c.lineTo(12, 50)
    c.closePath(); c.fill()
    c.beginPath()
    c.moveTo(-2, 50); c.lineTo(-1, 86); c.lineTo(4, 86); c.lineTo(4, 50)
    c.closePath(); c.fill()
    // копытца
    c.fillRect(-24, 92, 10, 4)
    c.fillRect(14, 92, 10, 4)
    // блик бронзы
    c.globalAlpha = 0.4
    c.strokeStyle = PAL.ochre
    c.lineWidth = 2
    c.beginPath()
    c.moveTo(-14, 32)
    c.quadraticCurveTo(-12, 42, 0, 45)
    c.stroke()
    out.push(cv)
  }
  // упавший барабан колонны
  {
    const [cv, c] = mk(96, 56)
    c.globalAlpha = 0.34
    c.translate(48, 28)
    c.rotate(-0.08)
    c.fillStyle = PAL.ink
    c.fillRect(-32, -16, 60, 32)
    c.beginPath()
    c.ellipse(-32, 0, 9, 16, 0, 0, Math.PI * 2)
    c.fill()
    // торец светлее, с центрوвой меткой
    c.globalAlpha = 0.22
    c.fillStyle = PAL.cream
    c.beginPath()
    c.ellipse(28, 0, 9, 16, 0, 0, Math.PI * 2)
    c.fill()
    c.globalAlpha = 0.4
    c.strokeStyle = PAL.ink
    c.lineWidth = 2
    c.beginPath()
    c.ellipse(28, 0, 9, 16, 0, 0, Math.PI * 2)
    c.stroke()
    c.beginPath()
    c.arc(28, 0, 3, 0, Math.PI * 2)
    c.stroke()
    // каннелюры вдоль
    c.globalAlpha = 0.45
    c.strokeStyle = PAL.bgDark
    c.lineWidth = 2
    for (let i = 0; i < 3; i++) {
      c.beginPath()
      c.moveTo(-30, -10 + i * 10)
      c.lineTo(26, -10 + i * 10)
      c.stroke()
    }
    out.push(cv)
  }
  // стела с надписью (псефизма)
  {
    const [cv, c] = mk(52, 120)
    c.globalAlpha = 0.34
    c.fillStyle = PAL.ink
    c.fillRect(10, 100, 32, 8)
    c.beginPath()
    c.moveTo(14, 100); c.lineTo(16, 22); c.lineTo(36, 22); c.lineTo(38, 100)
    c.closePath()
    c.fill()
    // фронтончик
    c.beginPath()
    c.moveTo(12, 22); c.lineTo(26, 10); c.lineTo(40, 22)
    c.closePath()
    c.fill()
    // строки надписи
    c.globalAlpha = 0.3
    c.fillStyle = PAL.cream
    for (let i = 0; i < 6; i++) c.fillRect(19, 30 + i * 9, 14 - (i % 3) * 3, 1.8)
    out.push(cv)
  }
  return out
}

// Розетка-филлер: вазописцы заполняли ими пустой фон вокруг фигур.
function rosette(c: CanvasRenderingContext2D, x: number, y: number, r: number, petals: number, alpha: number, tint: string): void {
  c.save()
  c.translate(x, y)
  c.globalAlpha = alpha
  c.fillStyle = tint
  c.beginPath()
  c.arc(0, 0, r * 0.26, 0, Math.PI * 2)
  c.fill()
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2
    c.beginPath()
    c.ellipse(Math.cos(a) * r * 0.68, Math.sin(a) * r * 0.68, r * 0.30, r * 0.18, a, 0, Math.PI * 2)
    c.fill()
  }
  c.restore()
}

// Пальметта (веер листьев) — медальон мощения.
function palmette(c: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number): void {
  c.save()
  c.translate(x, y)
  c.globalAlpha = alpha
  c.fillStyle = PAL.ink
  for (let i = -3; i <= 3; i++) {
    const a = -Math.PI / 2 + i * 0.34
    c.save()
    c.rotate(a)
    c.beginPath()
    c.ellipse(0, -r * 0.62, r * 0.16, r * 0.5, 0, 0, Math.PI * 2)
    c.fill()
    c.restore()
  }
  c.beginPath()
  c.arc(0, 0, r * 0.2, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = PAL.ink
  c.lineWidth = 2
  c.beginPath()
  c.arc(0, r * 0.16, r * 0.42, Math.PI * 0.15, Math.PI * 0.85)
  c.stroke()
  c.restore()
}

/**
 * Тайл фона: обожжённая терракота с кракелюром, плиты мощения, розетки,
 * галька, утварь и редкая меандровая дорога. Всё внутри полей [m, S−m],
 * кроме элементов, нарисованных с заворотом, — тайл сшивается без швов.
 */
function makePattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const S = 768
  const [cv, c] = mk(S, S)
  const rng = new RNG(20260611)
  c.fillStyle = PAL.bg
  c.fillRect(0, 0, S, S)
  // крупная неровность обжига (с заворотом на края)
  for (let i = 0; i < 110; i++) {
    const x = rng.next() * S
    const y = rng.next() * S
    const r = 14 + rng.next() * 52
    c.fillStyle = rng.next() < 0.52 ? 'rgba(40, 16, 4, 0.028)' : 'rgba(255, 226, 190, 0.024)'
    c.beginPath()
    for (let ox = -S; ox <= S; ox += S) {
      for (let oy = -S; oy <= S; oy += S) {
        c.moveTo(x + ox + r, y + oy)
        c.arc(x + ox, y + oy, r, 0, Math.PI * 2)
      }
    }
    c.fill()
  }
  // мощение: крупные плиты с волнистыми швами и светлой фаской снизу
  const seam = (vert: boolean, base: number, k: number) => {
    const wob = 6
    c.beginPath()
    for (let t = 0; t <= S; t += 16) {
      const off = base + Math.sin(((t / S) * Math.PI * 2 * 3) + k * 1.9) * wob
      const x = vert ? off : t
      const y = vert ? t : off
      if (t === 0) c.moveTo(x, y)
      else c.lineTo(x, y)
    }
    c.stroke()
  }
  for (let k = 0; k < 6; k++) {
    const base = k * 128 + 64
    c.strokeStyle = 'rgba(33, 21, 16, 0.075)'
    c.lineWidth = 2.6
    seam(false, base, k)
    seam(true, base, k + 3)
    c.strokeStyle = 'rgba(255, 226, 190, 0.05)'
    c.lineWidth = 1.4
    seam(false, base + 3, k)
    seam(true, base + 3, k + 3)
  }
  // кракелюр: короткие трещины-молнии
  c.strokeStyle = 'rgba(33, 21, 16, 0.085)'
  c.lineWidth = 1.1
  for (let i = 0; i < 34; i++) {
    let x = 30 + rng.next() * (S - 60)
    let y = 30 + rng.next() * (S - 60)
    let a = rng.next() * Math.PI * 2
    c.beginPath()
    c.moveTo(x, y)
    const segs = 3 + (rng.next() * 3 | 0)
    for (let k2 = 0; k2 < segs; k2++) {
      a += (rng.next() - 0.5) * 1.3
      const len = 9 + rng.next() * 18
      x += Math.cos(a) * len
      y += Math.sin(a) * len
      c.lineTo(x, y)
    }
    c.stroke()
  }
  // галька: кучки мелких овалов
  for (let i = 0; i < 12; i++) {
    const gx = 30 + rng.next() * (S - 60)
    const gy = 30 + rng.next() * (S - 60)
    const n = 4 + (rng.next() * 5 | 0)
    for (let k2 = 0; k2 < n; k2++) {
      const a = rng.next() * Math.PI * 2
      const d = rng.next() * 14
      c.fillStyle = rng.next() < 0.5 ? 'rgba(33, 21, 16, 0.07)' : 'rgba(255, 226, 190, 0.06)'
      c.beginPath()
      c.ellipse(gx + Math.cos(a) * d, gy + Math.sin(a) * d, 1.6 + rng.next() * 1.8, 1.1 + rng.next() * 1.3, a, 0, Math.PI * 2)
      c.fill()
    }
  }
  // розетки-филлеры — фирменный знак вазописи
  for (let i = 0; i < 11; i++) {
    const r = 5.5 + rng.next() * 6.5
    rosette(
      c, r + 14 + rng.next() * (S - 2 * r - 28), r + 14 + rng.next() * (S - 2 * r - 28),
      r, 6 + (rng.next() * 3 | 0), 0.085 + rng.next() * 0.05,
      rng.next() < 0.3 ? PAL.bgDark : PAL.ink,
    )
  }
  // два медальона-пальметты
  palmette(c, 120 + rng.next() * 180, 140 + rng.next() * 160, 26, 0.075)
  palmette(c, S - 280 + rng.next() * 160, S - 300 + rng.next() * 180, 31, 0.06)
  // меандровая «процессионная» дорога — одна на тайл, со светлой подложкой
  {
    const y = 384
    c.fillStyle = 'rgba(255, 226, 190, 0.045)'
    c.fillRect(0, y - 22, S, 44)
    c.strokeStyle = 'rgba(33, 21, 16, 0.14)'
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
    c.strokeStyle = 'rgba(33, 21, 16, 0.11)'
    c.lineWidth = 2
    c.beginPath()
    c.moveTo(0, y - 17); c.lineTo(S, y - 17)
    c.moveTo(0, y + 17); c.lineTo(S, y + 17)
    c.stroke()
  }
  // утварь: амфоры, веточки, черепки
  for (let i = 0; i < 9; i++) {
    const x = 40 + rng.next() * (S - 80)
    const y = 40 + rng.next() * (S - 80)
    c.save()
    c.translate(x, y)
    c.rotate(rng.next() * 0.7 - 0.35)
    c.globalAlpha = 0.07
    c.fillStyle = PAL.ink
    const kind = rng.next()
    if (kind < 0.4) {
      // амфора с пояском
      c.beginPath()
      c.ellipse(0, 0, 9, 13, 0, 0, Math.PI * 2)
      c.fill()
      c.fillRect(-4, -19, 8, 7)
      c.fillRect(-7, -21, 14, 3)
      c.globalAlpha = 0.05
      c.fillStyle = PAL.cream
      c.fillRect(-8, -3, 16, 2.2)
    } else if (kind < 0.75) {
      // оливковая веточка
      c.strokeStyle = PAL.ink
      c.lineWidth = 2.5
      c.beginPath()
      c.moveTo(-14, 6)
      c.quadraticCurveTo(0, -8, 16, -4)
      c.stroke()
      for (let k2 = 0; k2 < 5; k2++) {
        const t = k2 / 4
        c.beginPath()
        c.ellipse(-12 + t * 26, 2 - t * 8, 2, 3.6, 0.7 - t, 0, Math.PI * 2)
        c.fill()
      }
    } else {
      // рассыпанные черепки
      for (let k2 = 0; k2 < 4; k2++) {
        const sx = (rng.next() - 0.5) * 26
        const sy = (rng.next() - 0.5) * 20
        c.save()
        c.translate(sx, sy)
        c.rotate(rng.next() * Math.PI)
        c.beginPath()
        c.moveTo(-4, 0); c.lineTo(0, -3.4); c.lineTo(4.4, -0.6); c.lineTo(1, 3.2)
        c.closePath()
        c.fill()
        c.restore()
      }
    }
    c.restore()
  }
  return ctx.createPattern(cv, 'repeat')
}

export function buildSprites(ctx: CanvasRenderingContext2D): Sprites {
  return {
    enemies: [
      sprite(42, 44, drawMerchant),
      sprite(40, 44, drawGuard),
      sprite(50, 50, drawPlatonist),
      sprite(42, 40, drawSophist),
      sprite(64, 80, drawPlato),
    ],
    boss: sprite(82, 88, drawBoss),
    dog: sprite(30, 24, drawDog),
    glow: makeGlow(),
    gem: makeGem(),
    spit: makeSpit(),
    props: makeProps(),
    pattern: makePattern(ctx),
  }
}

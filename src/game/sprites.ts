// Вся графика рисуется кодом в offscreen-канвасы один раз при старте.
// Стиль — чернофигурная вазопись: тёмные силуэты, охра и белый как акценты.

import { PAL } from '../config'
import { RNG } from '../engine/rng'

export interface Sprite {
  /** Два кадра походки. */
  img: HTMLCanvasElement[]
  white: HTMLCanvasElement[]
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
type DrawFn = (c: CanvasRenderingContext2D, ink: string, ochre: string, cream: string, st: number) => void

/** Собирает спрайт: 2 кадра походки × (обычный + белый хит-флэш). 2x масштаб. */
function sprite(w: number, h: number, draw: DrawFn): Sprite {
  const img: HTMLCanvasElement[] = []
  const white: HTMLCanvasElement[] = []
  for (let f = 0; f < 2; f++) {
    const st = f === 0 ? 1 : -1
    const [cv1, c1] = mk(w * 2, h * 2)
    c1.scale(2, 2)
    c1.translate(w / 2, h / 2)
    draw(c1, PAL.ink, PAL.ochre, PAL.cream, st)
    img.push(cv1)
    const [cv2, c2] = mk(w * 2, h * 2)
    c2.scale(2, 2)
    c2.translate(w / 2, h / 2)
    draw(c2, PAL.cream, PAL.cream, PAL.cream, st)
    white.push(cv2)
  }
  return { img, white, ax: w / 2, ay: h / 2 }
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
const drawMerchant: DrawFn = (c, ink, ochre, cream, st) => {
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
  // сандалии
  c.fillStyle = ochre
  c.fillRect(-6.5 * st - 2.6, 9.6, 3.4, 1.2)
  c.fillRect(5.6 * st + 0.6, 9.2, 3.4, 1.2)
  // корпус-эксомис с наклоном вперёд
  c.fillStyle = ink
  c.beginPath()
  c.moveTo(-5, 2.5)
  c.quadraticCurveTo(-6, -5, -1.5, -7.5)
  c.lineTo(4, -6.5)
  c.quadraticCurveTo(5.5, -2, 4.5, 2.5)
  c.closePath()
  c.fill()
  // складки туники
  c.strokeStyle = ochre
  c.lineWidth = 0.8
  c.beginPath(); c.moveTo(-2.5, -4); c.lineTo(-3.2, 1.8); c.stroke()
  c.beginPath(); c.moveTo(0.5, -4.5); c.lineTo(0.2, 1.8); c.stroke()
  hem(c, cream, -4.8, 4.4, 1.6)
  // голова в профиль
  head(c, ink, cream, 4.2, -9.2, 2.9, 1.6)
  // повязка
  c.fillStyle = ochre
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
  // роспись на тулове
  c.fillStyle = ochre
  c.fillRect(-2.8, -1.2, 5.6, 1.1)
  c.fillStyle = cream
  for (let i = 0; i < 4; i++) c.fillRect(-2.4 + i * 1.5, 0.6, 0.8, 0.8)
  c.restore()
}

// Стражник-гоплит: коринфский шлем, круглый щит со звездой, копьё, поножи.
const drawGuard: DrawFn = (c, ink, ochre, cream, st) => {
  // копьё за щитом
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
  // ноги в шаге с поножами
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
  // птеруги (кожаные полосы юбки) видны под щитом
  c.fillStyle = ink
  for (let i = 0; i < 4; i++) {
    c.fillRect(-4.4 + i * 2.5, 3.4, 1.7, 3.4)
  }
  c.fillStyle = ochre
  for (let i = 0; i < 4; i++) c.fillRect(-4.2 + i * 2.5, 5.9, 1.3, 0.8)
  // щит-гоплон
  c.fillStyle = ink
  c.beginPath()
  c.arc(0, 0, 8.6, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = ochre
  c.lineWidth = 1.2
  c.beginPath()
  c.arc(0, 0, 6.8, 0, Math.PI * 2)
  c.stroke()
  // звезда Аргоса на щите
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
  c.fillStyle = cream
  c.fillRect(2.5, -10.6, 1.7, 1) // прорезь глаза
  // гребень из конского волоса (колышется)
  c.fillStyle = ochre
  c.beginPath()
  c.moveTo(-5.5, -12.5)
  c.quadraticCurveTo(0 + st, -18.5, 5.5, -12.8)
  c.quadraticCurveTo(0, -14.8, -5.5, -12.5)
  c.closePath()
  c.fill()
  c.strokeStyle = ink
  c.lineWidth = 0.6
  for (let i = 0; i < 4; i++) {
    c.beginPath()
    c.moveTo(-3.5 + i * 2.4, -13.2)
    c.lineTo(-3 + i * 2.4 + st * 0.5, -16 - (i % 2))
    c.stroke()
  }
}

// Платоник: тяжёлый гиматий с глубокими складками, борода, перст к миру идей.
const drawPlatonist: DrawFn = (c, ink, ochre, cream, st) => {
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
  // глубокие складки веером
  c.strokeStyle = ochre
  c.lineWidth = 1
  c.beginPath(); c.moveTo(-6, -3); c.quadraticCurveTo(-8 - st, 6, -8.5 - st, 13); c.stroke()
  c.beginPath(); c.moveTo(-1, -5); c.quadraticCurveTo(-1.5, 5, -2 - st * 0.5, 13.4); c.stroke()
  c.beginPath(); c.moveTo(3.5, -4); c.quadraticCurveTo(4.5, 5, 5 + st, 13); c.stroke()
  // перекинутый через плечо край (диагональ)
  c.strokeStyle = cream
  c.lineWidth = 1.2
  c.beginPath()
  c.moveTo(-6.5, -7)
  c.quadraticCurveTo(2, -2, 9.5, 7)
  c.stroke()
  // кайма по подолу
  hem(c, cream, -12 - st, 12.4 + st, 12.6, 3)
  // голова в профиль с длинной бородой
  head(c, ink, cream, 0.6, -13, 3.9, 3.4)
  // лента-диадема
  c.fillStyle = ochre
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
  c.fillStyle = cream
  c.fillRect(10.6, -20.2, 1.6, 3)
  c.restore()
}

// Софист: тощий ритор — хитон со складками, свиток, второй рукой вещает.
const drawSophist: DrawFn = (c, ink, ochre, cream, st) => {
  c.fillStyle = ink
  // узкий хитон, подол в шаге
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
  c.fillStyle = cream
  c.fillRect(7.6, -9.6, 4.6, 2)
  c.fillStyle = ochre
  c.fillRect(7.6, -9.6, 1, 2)
  c.fillRect(11.2, -9.6, 1, 2)
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
}

// Пёс Диогена.
const drawDog: DrawFn = (c, ink, ochre, cream, st) => {
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
  // лапы в беге (две пары крест-накрест)
  c.fillRect(-5.5 - st * 1.4, 2, 1.8, 4.4)
  c.fillRect(-1.5 + st * 1.2, 2.4, 1.8, 4)
  c.fillRect(2.5 - st * 1.2, 2, 1.8, 4.4)
  c.fillRect(5.2 + st * 1.4, 2.4, 1.6, 3.6)
  // хвост крючком
  c.strokeStyle = ink
  c.lineWidth = 1.6
  c.beginPath()
  c.moveTo(-6.5, -1)
  c.quadraticCurveTo(-10, -4 + st, -8.5, -6.5 + st * 0.7)
  c.stroke()
  // ошейник
  c.fillStyle = ochre
  c.fillRect(4.6, -1.4, 1.4, 2.6)
  // глаз
  c.fillStyle = cream
  c.fillRect(7.4, -3.2, 1, 1)
}

// Сам Платон: платоник в полтора роста, с лавром и свитком «Государства».
const drawPlato: DrawFn = (c, ink, ochre, cream, st) => {
  c.save()
  c.scale(1.55, 1.55)
  drawPlatonist(c, ink, ochre, cream, st)
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
const drawBoss: DrawFn = (c, ink, ochre, cream, st) => {
  // плащ за спиной (колышется)
  c.fillStyle = '#3a2014'
  c.beginPath()
  c.moveTo(-8, -18)
  c.quadraticCurveTo(-26 - st * 2, 0, -20 - st * 3, 26)
  c.lineTo(-6, 20)
  c.closePath()
  c.fill()
  c.fillStyle = ink
  // ноги в стойке
  c.beginPath()
  c.moveTo(-9, 8); c.lineTo(-13 - st, 27); c.lineTo(-7.5 - st, 27.5); c.lineTo(-3, 12)
  c.closePath(); c.fill()
  c.beginPath()
  c.moveTo(9, 8); c.lineTo(13 + st, 27); c.lineTo(7.5 + st, 27.5); c.lineTo(3, 12)
  c.closePath(); c.fill()
  // поножи
  c.fillStyle = cream
  c.fillRect(-12.2 - st, 18, 4, 1.6)
  c.fillRect(8.2 + st, 18, 4, 1.6)
  // птеруги — юбка из кожаных полос
  c.fillStyle = ink
  for (let i = 0; i < 5; i++) {
    const px = -9 + i * 4
    c.fillRect(px, 8, 2.8, 6.5 + (i % 2) * 1.2)
  }
  c.fillStyle = ochre
  for (let i = 0; i < 5; i++) c.fillRect(-8.7 + i * 4, 12.6, 2.2, 1)
  // торс-кираса
  c.fillStyle = ink
  c.beginPath()
  c.moveTo(-11, 10)
  c.quadraticCurveTo(-13, -8, -7, -13)
  c.lineTo(7, -13)
  c.quadraticCurveTo(13, -8, 11, 10)
  c.closePath()
  c.fill()
  // мускульная кираса: грудь, пресс, золотой пояс
  c.strokeStyle = ochre
  c.lineWidth = 1.4
  c.beginPath(); c.moveTo(-6, -5); c.quadraticCurveTo(0, -1, 6, -5); c.stroke()
  c.beginPath(); c.moveTo(-4.5, 0.5); c.quadraticCurveTo(0, 3, 4.5, 0.5); c.stroke()
  c.beginPath(); c.moveTo(-2.5, -8); c.lineTo(-2.5, -1); c.stroke()
  c.beginPath(); c.moveTo(2.5, -8); c.lineTo(2.5, -1); c.stroke()
  c.fillStyle = ochre
  c.fillRect(-10, 7.4, 20, 2)
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
  // прорезь глаза
  c.fillStyle = cream
  c.fillRect(3.2, -19.4, 2.8, 1.3)
  // высокий полосатый гребень
  c.fillStyle = ochre
  c.beginPath()
  c.moveTo(-10, -22)
  c.quadraticCurveTo(0, -35 - st, 10, -22.5)
  c.quadraticCurveTo(0, -26.5, -10, -22)
  c.closePath()
  c.fill()
  c.strokeStyle = ink
  c.lineWidth = 0.8
  for (let i = 0; i < 6; i++) {
    c.beginPath()
    c.moveTo(-7.5 + i * 3, -23.4)
    c.quadraticCurveTo(-6.5 + i * 3, -27 - st, -5.5 + i * 3 + st * 0.6, -30 - (i % 2) * 1.4)
    c.stroke()
  }
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
    c.fillRect(20, 28, 32, 96)    // ствол
    c.fillStyle = PAL.bgDark
    c.globalAlpha = 0.5
    for (let i = 0; i < 4; i++) c.fillRect(23 + i * 8, 30, 2.4, 92) // каннелюры
    c.globalAlpha = 0.34
    c.fillStyle = PAL.ink
    c.fillRect(14, 18, 44, 10)    // эхин
    c.fillRect(10, 8, 52, 10)     // абака, скол справа
    c.clearRect(48, 8, 14, 7)
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
    c.beginPath()
    c.arc(28, 20, 10, 0, Math.PI * 2) // голова
    c.fill()
    c.beginPath() // борода
    c.moveTo(21, 24); c.lineTo(28, 36); c.lineTo(35, 24)
    c.closePath()
    c.fill()
    c.globalAlpha = 0.5
    c.fillStyle = PAL.ochre
    c.fillRect(19, 12, 18, 2.4) // лента
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
    c.globalAlpha = 0.55
    c.strokeStyle = PAL.ochre
    c.lineWidth = 2.4
    c.beginPath()
    c.ellipse(0, 0, 24, 12, 0, 0.6, 2.5)
    c.stroke()
    c.globalAlpha = 0.6
    c.strokeStyle = PAL.bg
    c.lineWidth = 2
    c.beginPath()
    c.moveTo(-20, -14); c.lineTo(-12, -2); c.lineTo(-18, 8)
    c.stroke()
    out.push(cv)
  }
  return out
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
  // мощение: плиты с волнистыми швами (синус с целым числом периодов — тайлится)
  c.strokeStyle = 'rgba(33, 21, 16, 0.05)'
  c.lineWidth = 2.4
  for (let k = 0; k < 4; k++) {
    const base = k * 128 + 64
    c.beginPath()
    for (let x = 0; x <= S; x += 16) {
      const y = base + Math.sin(((x / S) * Math.PI * 2 * 3) + k * 1.7) * 5
      if (x === 0) c.moveTo(x, y)
      else c.lineTo(x, y)
    }
    c.stroke()
    c.beginPath()
    for (let y = 0; y <= S; y += 16) {
      const x = base + Math.sin(((y / S) * Math.PI * 2 * 3) + k * 2.3) * 5
      if (y === 0) c.moveTo(x, y)
      else c.lineTo(x, y)
    }
    c.stroke()
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
    spit: makeSpit(),
    props: makeProps(),
    pattern: makePattern(ctx),
  }
}

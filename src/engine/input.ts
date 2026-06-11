// Клавиатура + опциональный геймпад. Мышь для игры не нужна
// (клик используется только для кнопки mute, это обрабатывает main.ts).

export type Action =
  | 'up' | 'down' | 'left' | 'right'
  | 'confirm' | 'pause' | 'mute' | 'dash' | 'restart' | 'shop'
  | 'opt1' | 'opt2' | 'opt3'

const KEYMAP: Record<string, Action[]> = {
  KeyW: ['up'], ArrowUp: ['up'],
  KeyS: ['down'], ArrowDown: ['down'],
  KeyA: ['left'], ArrowLeft: ['left'],
  KeyD: ['right'], ArrowRight: ['right'],
  Space: ['dash', 'confirm'],
  Enter: ['confirm'], NumpadEnter: ['confirm'],
  Escape: ['pause'], KeyP: ['pause'],
  KeyM: ['mute'],
  KeyR: ['restart'],
  KeyL: ['shop'],
  Digit1: ['opt1'], Numpad1: ['opt1'],
  Digit2: ['opt2'], Numpad2: ['opt2'],
  Digit3: ['opt3'], Numpad3: ['opt3'],
}

const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

export class Input {
  private held = new Set<Action>()
  private edge = new Set<Action>()
  private gpPrev = 0 // битовая маска кнопок геймпада прошлого опроса
  moveX = 0
  moveY = 0
  /** Вектор виртуального стика (тач) — пишется слоем управления в main.ts. */
  touchX = 0
  touchY = 0
  /** Срабатывает на любой клавише — нужно, чтобы разбудить WebAudio. */
  onGesture: (() => void) | null = null

  /** Виртуальное нажатие действия (тач-кнопки, экранные зоны). */
  inject(a: Action): void {
    this.edge.add(a)
  }

  attach(): void {
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (PREVENT.has(e.code)) e.preventDefault()
      if (this.onGesture) this.onGesture()
      const acts = KEYMAP[e.code]
      if (!acts) return
      for (let i = 0; i < acts.length; i++) {
        if (!e.repeat && !this.held.has(acts[i])) this.edge.add(acts[i])
        this.held.add(acts[i])
      }
    })
    window.addEventListener('keyup', (e) => {
      const acts = KEYMAP[e.code]
      if (!acts) return
      for (let i = 0; i < acts.length; i++) this.held.delete(acts[i])
    })
    window.addEventListener('blur', () => {
      this.held.clear()
    })
  }

  /** Опрос геймпада + сборка вектора движения. Вызывать раз в тик. */
  poll(): void {
    let gx = 0
    let gy = 0
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const pads = navigator.getGamepads()
      for (let i = 0; i < pads.length; i++) {
        const p = pads[i]
        if (!p || !p.connected) continue
        const ax = p.axes.length > 0 ? p.axes[0] : 0
        const ay = p.axes.length > 1 ? p.axes[1] : 0
        if (Math.abs(ax) > 0.25) gx += ax
        if (Math.abs(ay) > 0.25) gy += ay
        let mask = 0
        const b = p.buttons
        const on = (k: number) => b.length > k && b[k].pressed
        if (on(0)) mask |= 1 // A: confirm + dash
        if (on(9)) mask |= 2 // Start: pause
        if (on(12)) gy -= 1
        if (on(13)) gy += 1
        if (on(14)) gx -= 1
        if (on(15)) gx += 1
        const rise = mask & ~this.gpPrev
        if (rise & 1) { this.edge.add('confirm'); this.edge.add('dash') }
        if (rise & 2) this.edge.add('pause')
        if (mask & 1) { this.held.add('confirm'); this.held.add('dash') }
        else { this.held.delete('confirm'); this.held.delete('dash') }
        this.gpPrev = mask
        break
      }
    }
    let x = gx + this.touchX + (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0)
    let y = gy + this.touchY + (this.held.has('down') ? 1 : 0) - (this.held.has('up') ? 1 : 0)
    const len = Math.hypot(x, y)
    if (len > 1) { x /= len; y /= len }
    this.moveX = x
    this.moveY = y
  }

  isDown(a: Action): boolean {
    return this.held.has(a)
  }

  wasPressed(a: Action): boolean {
    return this.edge.has(a)
  }

  /** Сброс фронтов — в конце каждого тика. */
  endTick(): void {
    this.edge.clear()
  }
}

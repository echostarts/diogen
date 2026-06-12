// Весь звук — синтез через WebAudio, без аудиофайлов.
// Контекст создаётся лениво по первому жесту пользователя; без него все методы — no-op.

export class AudioSys {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  private droneOsc: OscillatorNode | null = null
  private droneGain: GainNode | null = null
  private droneLfo: OscillatorNode | null = null
  private lastThud = 0
  private lastPick = 0
  muted = false

  constructor() {
    try {
      this.muted = localStorage.getItem('diogen_mute') === '1'
    } catch { /* приватный режим — пусть будет звук */ }
  }

  /** Создать контекст (вызывается по первому жесту). */
  ensure(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    try {
      const AC = window.AudioContext
      if (!AC) return
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.45
      this.master.connect(this.ctx.destination)
      const len = Math.floor(this.ctx.sampleRate * 0.25)
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const d = this.noiseBuf.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    } catch {
      this.ctx = null
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted
    try { localStorage.setItem('diogen_mute', this.muted ? '1' : '0') } catch { /* ок */ }
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.45, this.ctx.currentTime, 0.02)
    }
    return this.muted
  }

  private osc(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime + delay
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(Math.max(1, f0), t)
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.connect(g)
    g.connect(this.master)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  private noise(dur: number, vol: number, f0: number, f1: number, type: BiquadFilterType = 'bandpass'): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return
    const t = this.ctx.currentTime
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    const f = this.ctx.createBiquadFilter()
    f.type = type
    f.frequency.setValueAtTime(f0, t)
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.connect(f); f.connect(g); g.connect(this.master)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  /** Глухой удар (попадание/смерть врага). */
  thud(big = false): void {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    if (now - this.lastThud < 0.035) return
    this.lastThud = now
    this.osc('triangle', big ? 130 : 105, big ? 40 : 55, big ? 0.14 : 0.07, big ? 0.5 : 0.22)
    if (big) this.noise(0.12, 0.25, 500, 90, 'lowpass')
  }

  /** Щелчок подбора оливки. */
  pick(): void {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    if (now - this.lastPick < 0.03) return
    this.lastPick = now
    this.osc('square', 850 + Math.random() * 250, 1500, 0.05, 0.08)
  }

  shoot(): void { this.noise(0.06, 0.18, 1800, 400, 'highpass') }
  dogBite(): void { this.osc('sawtooth', 300, 90, 0.06, 0.12) }
  hurt(): void { this.osc('sawtooth', 170, 50, 0.25, 0.4); this.noise(0.15, 0.3, 350, 80, 'lowpass') }
  dash(): void { this.noise(0.25, 0.3, 280, 1900, 'bandpass') }
  levelup(): void { this.osc('sine', 660, 660, 0.12, 0.3); this.osc('sine', 990, 990, 0.2, 0.3, 0.1) }
  ui(): void { this.osc('square', 520, 560, 0.04, 0.1) }
  boom(): void { this.osc('sine', 75, 28, 0.55, 0.65); this.noise(0.4, 0.4, 600, 60, 'lowpass') }

  /** Горн глашатая — новая волна. */
  horn(): void {
    this.osc('sawtooth', 98, 147, 0.45, 0.13)
    this.osc('sawtooth', 196, 294, 0.45, 0.06)
  }

  /** Глухое сердцебиение при низком HP. */
  heart(): void {
    this.osc('sine', 62, 38, 0.1, 0.3)
    this.osc('sine', 58, 36, 0.09, 0.22, 0.16)
  }

  // --- музыка: степ-секвенсор (96 BPM, шестнадцатые), всё из осцилляторов ---
  private musNext = 0
  private musStep = 0
  private musBar = 0

  /** Нота в абсолютное время аудио-контекста. */
  private note(type: OscillatorType, f: number, t: number, dur: number, vol: number, slide = 1): void {
    if (!this.ctx || !this.master) return
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(Math.max(1, f), t)
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f * slide), t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.connect(g)
    g.connect(this.master)
    o.start(t)
    o.stop(t + dur + 0.03)
  }

  private noiseAt(t: number, dur: number, vol: number, f0: number, type: BiquadFilterType): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    const f = this.ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = f0
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.connect(f); f.connect(g); g.connect(this.master)
    src.start(t)
    src.stop(t + dur + 0.02)
  }

  /**
   * Планировщик фоновой музыки. Вызывается каждый игровой тик в ране.
   * intensity: 1 — ранняя игра, 2 — разгон, 3 — босс.
   */
  musicTick(intensity: number): void {
    if (!this.ctx || this.muted) return
    const now = this.ctx.currentTime
    const stepDur = 60 / 96 / 4
    // ресинк после паузы/меню
    if (this.musNext < now - 0.3) this.musNext = now + 0.05
    while (this.musNext < now + 0.18) {
      this.scheduleStep(this.musStep, this.musBar, this.musNext, intensity, stepDur)
      this.musNext += stepDur
      this.musStep = (this.musStep + 1) % 16
      if (this.musStep === 0) this.musBar++
    }
  }

  private scheduleStep(i: number, bar: number, t: number, inten: number, stepDur: number): void {
    // эолийский спуск a–g–f–e; у босса — мрачное топтание e–f
    const BASS = inten >= 3 ? [82.41, 87.31, 82.41, 77.78] : [110, 98, 87.31, 82.41]
    const root = BASS[bar % 4]
    // барабан-«пифос»
    if (i === 0 || i === 10 || (inten >= 2 && i === 8) || (inten >= 3 && i === 4)) {
      this.note('sine', 150, t, 0.12, 0.3, 0.35)
    }
    // глиняный «хэт»
    if (inten >= 1 && (i & 3) === 2) this.noiseAt(t, 0.04, 0.028, 5200, 'highpass')
    // бас держит тонику
    if (i === 0) this.note('triangle', root, t, stepDur * 7.5, 0.1)
    if (i === 8) this.note('triangle', root * (inten >= 3 ? 1.189 : 1), t, stepDur * 3.5, 0.08)
    // лира — минорная пентатоника поверх, негромко и с паузами
    if (inten >= 1 && (i & 1) === 0 && Math.random() < (inten >= 2 ? 0.5 : 0.34)) {
      const PENT = [1, 1.189, 1.335, 1.498, 1.782, 2]
      const f = root * 2 * PENT[(Math.random() * PENT.length) | 0]
      this.note('triangle', f, t, 0.5, 0.055)
      if (Math.random() < 0.3) this.note('triangle', f * 1.498, t + stepDur, 0.4, 0.03)
    }
    // раз в четыре такта — низкий «гонг»
    if (i === 0 && bar % 4 === 0) this.note('sine', root * 0.5, t, 1.6, 0.12)
  }

  stinger(win: boolean): void {
    const seq = win ? [392, 523, 659, 784] : [330, 262, 208, 156]
    for (let i = 0; i < seq.length; i++) this.osc('triangle', seq[i], seq[i], 0.22, 0.3, i * 0.13)
  }

  /** Низкий гул, пока жив босс. */
  drone(on: boolean): void {
    if (!this.ctx || !this.master) return
    if (on && !this.droneOsc) {
      const t = this.ctx.currentTime
      this.droneOsc = this.ctx.createOscillator()
      this.droneOsc.type = 'sawtooth'
      this.droneOsc.frequency.value = 52
      const lp = this.ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 130
      this.droneGain = this.ctx.createGain()
      this.droneGain.gain.setValueAtTime(0.0001, t)
      this.droneGain.gain.exponentialRampToValueAtTime(0.09, t + 1.2)
      this.droneLfo = this.ctx.createOscillator()
      this.droneLfo.frequency.value = 0.7
      const lfoG = this.ctx.createGain()
      lfoG.gain.value = 0.03
      this.droneLfo.connect(lfoG)
      lfoG.connect(this.droneGain.gain)
      this.droneOsc.connect(lp); lp.connect(this.droneGain); this.droneGain.connect(this.master)
      this.droneOsc.start(t)
      this.droneLfo.start(t)
    } else if (!on && this.droneOsc) {
      const t = this.ctx.currentTime
      if (this.droneGain) {
        this.droneGain.gain.cancelScheduledValues(t)
        this.droneGain.gain.setTargetAtTime(0.0001, t, 0.3)
      }
      this.droneOsc.stop(t + 1.5)
      this.droneLfo?.stop(t + 1.5)
      this.droneOsc = null
      this.droneGain = null
      this.droneLfo = null
    }
  }
}

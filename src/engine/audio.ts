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

  private ambT = 2
  /** Редкие тихие ноты лиры — фоновая атмосфера. Вызывается каждый тик рана. */
  ambientStep(dt: number): void {
    if (!this.ctx || this.muted) return
    this.ambT -= dt
    if (this.ambT > 0) return
    this.ambT = 4 + Math.random() * 4
    const scale = [220, 261.63, 293.66, 329.63, 392]
    const f = scale[(Math.random() * scale.length) | 0]
    this.osc('triangle', f, f * 0.995, 1.3, 0.045)
    if (Math.random() < 0.5) this.osc('triangle', f * 1.5, f * 1.5, 1.1, 0.025, 0.28)
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

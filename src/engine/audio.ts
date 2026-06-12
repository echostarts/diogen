// Эффекты — синтез через WebAudio; музыка и джинглы — OGG из public/audio
// (CC0, см. assets/ASSETS.md), а синтез-секвенсор остаётся фолбэком на случай,
// когда файлы не загрузились. Контекст создаётся лениво по первому жесту
// пользователя; без него все методы — no-op.

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

  // Файловая музыка: HTMLAudio-элементы (стримятся, не держат PCM в памяти).
  private elRun: HTMLAudioElement | null = null
  private elBoss: HTMLAudioElement | null = null
  private runOk = true // false после ошибки загрузки — трек берёт на себя синтез
  private bossOk = true
  private musicUnlocked = false // авто-play() разрешён браузером (после жеста)
  private musicKind: 'none' | 'run' | 'boss' = 'none'
  private ducked = false
  private readonly fades = new Map<HTMLAudioElement, ReturnType<typeof setInterval>>()
  // Банк коротких сэмплов: имя → варианты (играется случайный).
  private readonly bank = new Map<string, AudioBuffer[]>()
  private lastRam = 0

  constructor() {
    try {
      this.muted = localStorage.getItem('diogen_mute') === '1'
    } catch { /* приватный режим — пусть будет звук */ }
    // в скрытой вкладке rAF стоит, а аудио-элементы играли бы дальше — глушим
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.elRun?.pause()
        this.elBoss?.pause()
      } else if (this.musicKind !== 'none') {
        void this.curEl()?.play().catch(() => { /* вернётся со следующим жестом */ })
      }
    })
  }

  /** Создать контекст (вызывается по первому жесту). */
  ensure(): void {
    this.initMusic()
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
      this.loadBank()
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
    if (this.elRun) this.elRun.muted = this.muted
    if (this.elBoss) this.elBoss.muted = this.muted
    return this.muted
  }

  // --- файловая музыка: греческие струнные на ран, боевой трек — на Александра ---

  private mkTrack(path: string, onErr: () => void): HTMLAudioElement | null {
    try {
      const el = new Audio(new URL(path, document.baseURI).href)
      el.loop = true
      el.preload = 'auto'
      el.volume = 0
      el.muted = this.muted
      el.addEventListener('error', onErr)
      return el
    } catch {
      onErr()
      return null
    }
  }

  /** Создать треки и «разблокировать» автоплей. Зовётся из жеста, идемпотентно. */
  private initMusic(): void {
    if (!this.elRun && this.runOk) {
      this.elRun = this.mkTrack('audio/music/run.ogg', () => { this.runOk = false })
      this.elBoss = this.mkTrack('audio/music/boss.ogg', () => { this.bossOk = false })
    }
    if (this.musicUnlocked) return
    // iOS требует play() прямо из жеста — пробуем оба трека, лишний глушим
    for (const el of [this.elRun, this.elBoss]) {
      if (!el || !el.paused) continue
      el.play().then(() => {
        this.musicUnlocked = true
        if (el !== this.curEl()) {
          el.pause()
          el.currentTime = 0
        }
      }).catch(() => { /* жест не засчитан — повторим на следующем */ })
    }
  }

  private curEl(): HTMLAudioElement | null {
    return this.musicKind === 'run' ? this.elRun : this.musicKind === 'boss' ? this.elBoss : null
  }

  // Элементы идут мимо master (0.45), поэтому громкость здесь уже «эффективная»:
  // музыка чуть ниже пиков эффектов, в паузе приседает втрое.
  private musicVol(kind: 'run' | 'boss'): number {
    return (kind === 'run' ? 0.17 : 0.21) * (this.ducked ? 0.3 : 1)
  }

  /** Плавный фейд громкости элемента; цель 0 ставит трек на паузу в конце. */
  private fadeTo(el: HTMLAudioElement, target: number, sec: number): void {
    const old = this.fades.get(el)
    if (old !== undefined) clearInterval(old)
    const stepMs = 50
    const steps = Math.max(1, Math.round((sec * 1000) / stepMs))
    const delta = (target - el.volume) / steps
    const id = setInterval(() => {
      const v = el.volume + delta
      const done = delta >= 0 ? v >= target : v <= target
      el.volume = Math.min(1, Math.max(0, done ? target : v))
      if (done) {
        if (target <= 0) el.pause()
        clearInterval(id)
        this.fades.delete(el)
      }
    }, stepMs)
    this.fades.set(el, id)
  }

  /**
   * Держит нужный файловый трек и кроссфейдит ран↔босс.
   * true — музыка файловая, синтез-секвенсору делать нечего.
   */
  private driveMusic(wantBoss: boolean): boolean {
    const kind = wantBoss ? 'boss' : 'run'
    const el = wantBoss ? this.elBoss : this.elRun
    const ok = wantBoss ? this.bossOk : this.runOk
    if (!el || !ok || !this.musicUnlocked) return false
    if (this.musicKind !== kind) {
      const prev = this.curEl()
      if (prev) this.fadeTo(prev, 0, 1.6)
      this.musicKind = kind
      el.currentTime = 0
      this.drone(false) // синтетический гул под файловый трек не нужен
      this.fadeTo(el, this.musicVol(kind), wantBoss ? 0.7 : 1.2)
    }
    if (el.paused && !document.hidden) {
      void el.play().catch(() => { this.musicUnlocked = false }) // ждём нового жеста
    }
    return true
  }

  /** Увести музыку в тишину (финал рана, выход в меню). */
  stopMusic(fadeSec = 1): void {
    this.musicKind = 'none'
    for (const el of [this.elRun, this.elBoss]) {
      if (el && !el.paused) this.fadeTo(el, 0, fadeSec)
    }
  }

  /** Приглушить музыку (меню паузы), и вернуть обратно. */
  duckMusic(on: boolean): void {
    if (this.ducked === on) return
    this.ducked = on
    const kind = this.musicKind
    if (kind === 'none') return
    const el = this.curEl()
    if (el) this.fadeTo(el, this.musicVol(kind), 0.35)
  }

  // --- банк сэмплов (джинглы и фоли из public/audio) с синтез-фолбэками ---

  private loadBank(): void {
    const ctx = this.ctx
    if (!ctx) return
    const plan: Array<[string, string[]]> = [
      ['win', ['audio/jingles/win.ogg']],
      ['lose', ['audio/jingles/lose.ogg']],
      ['evolve', ['audio/jingles/evolve.ogg']],
      ['ram', seq('ram', 5)],     // дерево: бочка-таран
      ['hit', seq('hit', 5)],     // мягкий тяжёлый удар: жирные попадания, раны
      ['click', seq('click', 3)], // навигация меню
      ['confirm', seq('confirm', 2)],
      ['deny', seq('deny', 2)],   // не хватает черепков
      ['shard', seq('shard', 1)], // звон покупки
      ['crowd', seq('crowd', 1)], // гул агоры
    ]
    for (const [name, files] of plan) {
      const list: AudioBuffer[] = []
      this.bank.set(name, list)
      for (const f of files) {
        fetch(new URL(f, document.baseURI).href)
          .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
          .then((b) => ctx.decodeAudioData(b))
          .then((buf) => { list.push(buf) })
          .catch(() => { /* останется синтез */ })
      }
    }
    function seq(name: string, n: number): string[] {
      const out: string[] = []
      for (let i = 0; i < n; i++) out.push('audio/sfx/' + name + '_' + i + '.ogg')
      return out
    }
  }

  /** Случайный вариант из банка; rateVar — разброс высоты. false — банк пуст. */
  private sfx(name: string, vol: number, rate = 1, rateVar = 0): boolean {
    const list = this.bank.get(name)
    if (!list || list.length === 0 || !this.ctx || !this.master) return false
    const src = this.ctx.createBufferSource()
    src.buffer = list[(Math.random() * list.length) | 0]
    src.playbackRate.value = rate + (Math.random() * 2 - 1) * rateVar
    const g = this.ctx.createGain()
    g.gain.value = vol
    src.connect(g)
    g.connect(this.master)
    src.start()
    return true
  }

  /** Фанфара на эволюцию оружия. */
  evolve(): void {
    if (this.sfx('evolve', 0.55)) return
    const seq = [523, 659, 784, 1047]
    for (let i = 0; i < seq.length; i++) this.osc('triangle', seq[i], seq[i], 0.16, 0.26, i * 0.08)
  }

  /** Деревянный тук бочки-тарана (не чаще раза в ~90 мс). */
  ram(): void {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    if (now - this.lastRam < 0.09) return
    this.lastRam = now
    if (this.sfx('ram', 0.4, 1, 0.12)) return
    this.thud(true)
  }

  /** Подтверждение выбора (карта апгрейда). */
  confirm(): void {
    if (this.sfx('confirm', 0.38)) return
    this.osc('square', 520, 700, 0.07, 0.12)
  }

  /** Отказ: не хватает черепков. */
  deny(): void {
    if (this.sfx('deny', 0.38)) return
    this.osc('sawtooth', 160, 90, 0.18, 0.2)
  }

  /** Звон черепков при покупке. */
  shard(): void {
    if (this.sfx('shard', 0.5, 1, 0.08)) return
    this.osc('square', 1100, 1600, 0.08, 0.12)
  }

  /** Гул возмущённой толпы: старт рана, выход Александра. */
  crowd(vol: number): void {
    this.sfx('crowd', vol, 1, 0.06)
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
    if (big) this.sfx('hit', 0.26, 0.85, 0.1) // фоли-слой поверх синтеза
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
  hurt(): void {
    this.osc('sawtooth', 170, 50, 0.25, 0.4)
    this.noise(0.15, 0.3, 350, 80, 'lowpass')
    this.sfx('hit', 0.45, 0.7, 0.06) // фоли-вес пропущенного удара
  }
  dash(): void { this.noise(0.25, 0.3, 280, 1900, 'bandpass') }
  levelup(): void { this.osc('sine', 660, 660, 0.12, 0.3); this.osc('sine', 990, 990, 0.2, 0.3, 0.1) }
  ui(): void {
    if (this.sfx('click', 0.3)) return
    this.osc('square', 520, 560, 0.04, 0.1)
  }
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
   * Музыка рана. Вызывается каждый игровой тик в ране.
   * intensity: 1 — ранняя игра, 2 — разгон, 3 — босс.
   * Если файловые треки доступны — играют они, иначе степ-секвенсор ниже.
   */
  musicTick(intensity: number): void {
    if (!this.ctx) return
    if (this.driveMusic(intensity >= 3)) return
    if (this.muted) return
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

  /** Финал рана: музыка уходит, звучит джингл (или синтез-аккорд). */
  stinger(win: boolean): void {
    this.stopMusic(win ? 1.4 : 0.8)
    if (this.sfx(win ? 'win' : 'lose', 0.6)) return
    const seq = win ? [392, 523, 659, 784] : [330, 262, 208, 156]
    for (let i = 0; i < seq.length; i++) this.osc('triangle', seq[i], seq[i], 0.22, 0.3, i * 0.13)
  }

  /** Низкий гул, пока жив босс. */
  drone(on: boolean): void {
    if (!this.ctx || !this.master) return
    // под файловый босс-трек синтетический гул не нужен
    if (on && this.musicUnlocked && this.bossOk && this.elBoss) return
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
